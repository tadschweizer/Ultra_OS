import crypto from 'crypto';
import cookie from 'cookie';
import { getAthleteByCookie, getSupabaseAdminClient } from './authServer.js';
import { getStripeClient } from './stripeServer.js';
import { getBillingPlan, getBillingPriceId, getPublicCheckoutPath } from './billingPlans.js';
import { billingSiteUrl, requireBillingPost, signBillingIntent, verifyBillingIntent } from './billingSecurity.js';
import { appendSetCookie } from './auth/sessionCookies.js';

function priceDetails(price, requireActive = true) {
  if ((requireActive && !price?.active) || !Number.isInteger(price?.unit_amount) || !price.recurring
      || price.recurring.usage_type === 'metered' || price.type !== 'recurring') {
    throw new Error('Unsupported billing price.');
  }
  return { id: price.id, amount: price.unit_amount, currency: price.currency,
    interval: price.recurring.interval, intervalCount: price.recurring.interval_count };
}

function subscriptionState(subscription) {
  if (!subscription || ['canceled', 'incomplete_expired'].includes(subscription.status)) return null;
  const items = subscription.items?.data || [];
  if (items.length !== 1 || items[0].quantity !== 1 || !['active', 'trialing', 'past_due'].includes(subscription.status)) {
    throw new Error('Subscription requires manual billing management.');
  }
  return { id: subscription.id, itemId: items[0].id, priceId: items[0].price.id,
    quantity: items[0].quantity, status: subscription.status,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end), customer: subscription.customer };
}

export function createBillingFlowHandler(action, {
  getClient = getSupabaseAdminClient, getAthlete = getAthleteByCookie,
  getStripe = getStripeClient, now = Date.now,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      // Old signup/email destinations are read-only bookmarks; no Stripe call.
      if (action === 'checkout' && req.method === 'GET') {
        if (!getPublicCheckoutPath(req.query?.plan)) {
          return res.status(403).json({ error: 'This plan is not available for public checkout.' });
        }
        return res.redirect(303, `/billing/checkout?plan=${encodeURIComponent(req.query.plan)}`);
      }
      if (action === 'preview') {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return res.status(405).json({ error: 'Method not allowed.' });
        }
      } else if (!requireBillingPost(req, res)) return;

      const planId = action === 'preview' ? req.query?.plan : req.body?.plan;
      const plan = getBillingPlan(planId);
      if (action !== 'portal' && (!plan || !getPublicCheckoutPath(planId))) {
        return res.status(403).json({ error: 'This plan is not available for public checkout.' });
      }
      const athlete = await getAthlete(req, getClient());
      if (!athlete) return res.status(401).json({ error: 'Please log in to review billing.' });
      const stripe = getStripe();
      const siteUrl = billingSiteUrl();
      if (action === 'portal') {
        // Email alone is not proof of Stripe customer ownership.
        if (!athlete.stripe_customer_id) {
          return res.status(409).json({ error: 'Billing is not linked yet. Refresh your billing status or contact support.' });
        }
        const session = await stripe.billingPortal.sessions.create({
          customer: athlete.stripe_customer_id, return_url: `${siteUrl}/account?checkout=returned`,
        });
        return res.status(200).json({ url: session.url });
      }

      const priceId = getBillingPriceId(planId);
      if (!priceId) throw new Error('Price unavailable.');
      const price = priceDetails(await stripe.prices.retrieve(priceId));
      // Find subscriptions even if a delayed webhook has not saved their ID.
      let subscription = null;
      let checkoutGeneration = 'initial';
      if (athlete.stripe_customer_id) {
        const list = await stripe.subscriptions.list({ customer: athlete.stripe_customer_id, status: 'all', limit: 100 });
        const live = list.data.filter(s => !['canceled', 'incomplete_expired'].includes(s.status));
        if (list.has_more || live.length > 1) throw new Error('Ambiguous subscriptions.');
        subscription = live[0] || null;
        checkoutGeneration = list.data[0]?.id || 'initial';
      } else if (athlete.stripe_subscription_id) {
        throw new Error('Subscription has no linked customer.');
      }
      const current = subscriptionState(subscription);
      if (current && current.customer !== athlete.stripe_customer_id) throw new Error('Customer mismatch.');
      if (subscription?.metadata?.athlete_id && subscription.metadata.athlete_id !== athlete.id) {
        throw new Error('Subscription owner mismatch.');
      }

      if (action === 'preview') {
        const intent = signBillingIntent({ athleteId: athlete.id, planId, price, current,
          requestId: crypto.randomUUID(), expiresAt: now() + 15 * 60 * 1000 });
        return res.status(200).json({ plan: { id: plan.id, label: plan.label }, price,
          currentPrice: current ? priceDetails(subscription.items.data[0].price, false) : null,
          changing: Boolean(current), samePlan: current?.priceId === priceId, intent });
      }
      const intent = verifyBillingIntent(req.body?.intent, now());
      if (!intent || intent.athleteId !== athlete.id || intent.planId !== planId
          || JSON.stringify(intent.price) !== JSON.stringify(price)
          || JSON.stringify(intent.current) !== JSON.stringify(current)) {
        return res.status(409).json({ error: 'Your billing details changed or this review expired. Review the plan again before continuing.' });
      }
      const options = { idempotencyKey: `threshold-billing-${athlete.id}-${intent.requestId}` };
      if (current) {
        const session = await stripe.billingPortal.sessions.create({
          customer: athlete.stripe_customer_id, return_url: `${siteUrl}/account?checkout=returned`,
          ...(current.priceId === priceId ? {} : { flow_data: {
            type: 'subscription_update_confirm',
            subscription_update_confirm: { subscription: current.id,
              items: [{ id: current.itemId, price: priceId, quantity: current.quantity || 1 }] },
            after_completion: { type: 'redirect', redirect: { return_url: `${siteUrl}/account?checkout=returned` } },
          } }),
        }, options);
        // Hosted confirmation owns prorations, payment failure and 3DS.
        // This endpoint never changes a subscription or grants a tier.
        return res.status(200).json({ url: session.url });
      }
      const metadata = { athlete_id: athlete.id, subscription_tier: plan.tier, billing_plan: plan.id };
      // Link a deterministic customer before payment, closing the webhook-delay
      // gap where multiple visits could otherwise start unrelated subscriptions.
      let customerId = athlete.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({ metadata: { athlete_id: athlete.id } },
          { idempotencyKey: `threshold-customer-${athlete.id}` });
        const { data, error } = await getClient().from('athletes')
          .update({ stripe_customer_id: customer.id }).eq('id', athlete.id)
          .is('stripe_customer_id', null).select('stripe_customer_id').maybeSingle();
        if (error) throw error;
        if (!data) {
          // Another request may have linked the customer while we awaited Stripe.
          const result = await getClient().from('athletes').select('stripe_customer_id').eq('id', athlete.id).single();
          if (result.error || !result.data?.stripe_customer_id) throw new Error('Customer link failed.');
          customerId = result.data.stripe_customer_id;
        } else customerId = data.stripe_customer_id;
      }
      const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
      if (open.has_more) throw new Error('Too many pending checkouts.');
      const pending = open.data.find(s => s.mode === 'subscription');
      if (pending) {
        if (pending.metadata?.athlete_id !== athlete.id || pending.metadata?.billing_plan !== plan.id) {
          return res.status(409).json({ error: 'You have another checkout in progress. Return to that plan to finish it before starting a different one.' });
        }
        const lines = await stripe.checkout.sessions.listLineItems(pending.id, { limit: 2 });
        if (lines.has_more || lines.data.length !== 1 || lines.data[0].price?.id !== priceId || lines.data[0].quantity !== 1) {
          return res.status(409).json({ error: 'Your pending checkout has different billing details. Please contact support before continuing.' });
        }
        return res.status(200).json({ url: pending.url });
      }
      // Concurrent reviews share one key until the subscription lifecycle
      // changes. A conflicting plan is rejected rather than double-billed.
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', success_url: `${siteUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/billing/checkout?plan=${encodeURIComponent(plan.id)}&cancelled=1`,
        line_items: [{ price: priceId, quantity: 1 }],
        customer: customerId,
        allow_promotion_codes: true, client_reference_id: athlete.id, metadata,
        subscription_data: { metadata },
      }, { idempotencyKey: `threshold-checkout-${athlete.id}-${checkoutGeneration}` });
      if (session.status && session.status !== 'open') {
        return res.status(409).json({ error: 'This checkout is no longer open. Refresh your billing status before trying again.' });
      }
      appendSetCookie(res, cookie.serialize('pending_checkout_session_id', session.id, {
        httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 3600,
      }));
      return res.status(200).json({ url: session.url });
    } catch (error) {
      console.error(`[billing/${action}] failed:`, { type: error?.type || error?.name, code: error?.code });
      return res.status(503).json({ error: 'Billing is temporarily unavailable. Please try again or contact support.' });
    }
  };
}
