import { getAthleteByCookie, getSupabaseAdminClient } from '../../../lib/authServer';
import {
  getBillingPlan,
  getBillingPriceId,
  isEntitledSubscriptionStatus,
} from '../../../lib/billingPlans';
import { getStripeClient } from '../../../lib/stripeServer';
import cookie from 'cookie';
import crypto from 'crypto';

function getRequestOrigin(req) {
  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const forwardedHostHeader = req.headers['x-forwarded-host'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : String(forwardedProtoHeader || '').split(',')[0].trim();
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : String(forwardedHostHeader || '').split(',')[0].trim();

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = req.headers.host;
  if (host) {
    const protocol = host.includes('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https';
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function appendSetCookie(res, nextCookie) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', nextCookie);
    return;
  }

  const cookies = Array.isArray(current) ? current : [current];
  res.setHeader('Set-Cookie', [...cookies, nextCookie]);
}

function signPendingBillingState(payload) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export default async function handler(req, res) {
  const { plan: planId } = req.query;
  const plan = getBillingPlan(planId);

  if (!plan) {
    res.status(400).json({ error: 'Unknown billing plan.' });
    return;
  }

  const athlete = await getAthleteByCookie(req, getSupabaseAdminClient());
  if (!athlete) {
    res.redirect(`/signup?plan=${encodeURIComponent(planId)}`);
    return;
  }

  const priceId = getBillingPriceId(planId);
  if (!priceId) {
    res.status(500).json({ error: `Missing Stripe price configuration for ${plan.label}.` });
    return;
  }

  try {
    const stripe = getStripeClient();
    const siteUrl = getRequestOrigin(req);

    const metadata = {
      athlete_id: athlete.id,
      subscription_tier: plan.tier,
      billing_plan: plan.id,
    };

    // If the athlete already has a live subscription, never create a second
    // one (that would double-bill). Switch the existing subscription to the
    // requested price in place, with proration handled by Stripe.
    if (athlete.stripe_subscription_id) {
      let existing = null;
      try {
        existing = await stripe.subscriptions.retrieve(athlete.stripe_subscription_id, {
          expand: ['items.data.price'],
        });
      } catch (error) {
        if (error?.code !== 'resource_missing') throw error;
      }

      if (existing && isEntitledSubscriptionStatus(existing.status)) {
        const currentItem = existing.items?.data?.[0];
        if (currentItem?.price?.id === priceId) {
          // Already on this plan — send them to the portal to manage it.
          res.redirect(303, `${siteUrl}/api/billing/portal`);
          return;
        }

        const updated = await stripe.subscriptions.update(existing.id, {
          items: [{ id: currentItem.id, price: priceId }],
          proration_behavior: 'always_invoice',
          cancel_at_period_end: false,
          metadata,
        });

        await getSupabaseAdminClient()
          .from('athletes')
          .update({
            subscription_tier: plan.tier,
            stripe_price_id: priceId,
            stripe_subscription_status: updated.status,
          })
          .eq('id', athlete.id);

        res.redirect(303, `${siteUrl}/account?checkout=updated&plan=${encodeURIComponent(plan.id)}`);
        return;
      }
    }

    const buildSessionParams = (useStoredCustomer) => ({
      mode: 'subscription',
      success_url: `${siteUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
      line_items: [{ price: priceId, quantity: 1 }],
      customer: useStoredCustomer ? athlete.stripe_customer_id : undefined,
      customer_email: useStoredCustomer ? undefined : athlete.email || undefined,
      allow_promotion_codes: true,
      client_reference_id: athlete.id,
      metadata,
      subscription_data: { metadata },
    });

    let session;
    try {
      session = await stripe.checkout.sessions.create(
        buildSessionParams(Boolean(athlete.stripe_customer_id))
      );
    } catch (error) {
      // A stored Stripe customer id can become stale when the Stripe account or
      // mode changes (e.g. a fresh sandbox), causing a "No such customer" error.
      // In that case, retry without the customer so checkout still works and let
      // the webhook reconcile the customer id afterwards.
      const isMissingCustomer =
        athlete.stripe_customer_id &&
        error?.code === 'resource_missing' &&
        error?.param === 'customer';

      if (!isMissingCustomer) {
        throw error;
      }

      console.warn(
        `[billing/checkout] stale stripe_customer_id for athlete ${athlete.id}; retrying without it`
      );
      session = await stripe.checkout.sessions.create(buildSessionParams(false));
    }

    appendSetCookie(
      res,
      cookie.serialize('pending_checkout_session_id', session.id, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60,
      })
    );
    appendSetCookie(
      res,
      cookie.serialize(
        'pending_billing_state',
        signPendingBillingState({ athleteId: athlete.id, sessionId: session.id }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60,
        }
      )
    );

    res.redirect(303, session.url);
  } catch (error) {
    console.error('[billing/checkout] failed:', error);
    const detail =
      error?.raw?.message || error?.message || 'Could not start checkout session.';
    res.status(500).json({ error: 'Could not start checkout session.', detail });
  }
}
