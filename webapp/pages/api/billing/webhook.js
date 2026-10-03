import { getTierFromSubscription, isEntitledSubscriptionStatus } from '../../../lib/billingPlans.js';
import { getStripeClient } from '../../../lib/stripeServer.js';
import { getSupabaseAdminClient } from '../../../lib/authServer.js';

export const config = { api: { bodyParser: false } };
const idOf = value => typeof value === 'string' ? value : value?.id || null;
const supported = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'customer.subscription.created', 'customer.subscription.updated',
  'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed']);
async function readRawBody(req) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    bytes += buffer.length;
    if (bytes > 1024 * 1024) throw new Error('Webhook too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
async function rpc(admin, name, args) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  return data;
}

export function createBillingWebhookHandler({ getStripe = getStripeClient, getClient = getSupabaseAdminClient,
  secret = () => process.env.STRIPE_WEBHOOK_SECRET } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
    if (!req.headers['stripe-signature']) return res.status(400).json({ error: 'Missing Stripe signature.' });
    let stripe; let event;
    try { stripe = getStripe(); if (!secret()) throw new Error('Signing secret unavailable'); }
    catch { return res.status(503).json({ error: 'Billing processing is unavailable.' }); }
    try { event = stripe.webhooks.constructEvent(await readRawBody(req), req.headers['stripe-signature'], secret()); }
    catch { return res.status(400).json({ error: 'Webhook signature verification failed.' }); }
    if (!supported.has(event.type)) return res.status(200).json({ received: true });
    const object = event.data.object;
    const customerId = idOf(object.customer);
    if (!customerId || !event.id) return res.status(400).json({ error: 'Invalid billing event.' });
    let admin; let lease;
    try {
      admin = getClient();
      const claim = await rpc(admin, 'claim_billing_webhook', {
        p_event_id: event.id, p_customer_id: customerId, p_event_type: event.type,
      });
      if (claim?.duplicate) return res.status(200).json({ received: true, duplicate: true });
      if (claim?.busy || !claim?.lease_token) { res.setHeader('Retry-After', '5'); return res.status(503).json({ error: 'Billing update in progress. Retry this event.' }); }
      lease = claim.lease_token;
      // Retrieve CURRENT state under the customer lease, never apply a historic
      // event snapshot. An old cancellation cannot overwrite a newer subscription.
      const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100, expand: ['data.items.data.price'] });
      const live = list.data.filter(s => !['canceled', 'incomplete_expired'].includes(s.status));
      if (list.has_more || live.length > 1) throw new Error('Ambiguous billing state');
      const subscription = live[0] || list.data[0] || null;
      const { data: linked, error } = await admin.from('athletes').select('id, stripe_customer_id').eq('stripe_customer_id', customerId).maybeSingle();
      if (error) throw error;
      let athlete = linked;
      // Legacy checkout may predate customer linking. Only verified metadata and
      // an unbound/matching row may recover that association; never use email.
      const ownerId = object.metadata?.athlete_id || subscription?.metadata?.athlete_id;
      if (!athlete && ownerId) {
        const result = await admin.from('athletes').select('id, stripe_customer_id').eq('id', ownerId).maybeSingle();
        if (result.error) throw result.error;
        if (result.data && (!result.data.stripe_customer_id || result.data.stripe_customer_id === customerId)) athlete = result.data;
      }
      if (athlete && subscription?.metadata?.athlete_id && subscription.metadata.athlete_id !== athlete.id) throw new Error('Billing owner mismatch');
      const checkoutEvent = event.type.startsWith('checkout.session.');
      // Async checkout completion does not grant access before settlement. Its
      // later async success/failure event has a separate durable receipt.
      const unpaidCheckout = checkoutEvent && !['paid', 'no_payment_required'].includes(object.payment_status)
        && event.type !== 'checkout.session.async_payment_failed';
      if (unpaidCheckout) {
        await rpc(admin, 'finish_billing_webhook', { p_event_id: event.id, p_customer_id: customerId,
          p_lease_token: lease, p_athlete_id: null, p_snapshot: null });
        return res.status(200).json({ received: true, pending: true });
      }
      const entitled = isEntitledSubscriptionStatus(subscription?.status);
      const snapshot = { subscription_id: subscription?.id || null, price_id: subscription?.items?.data?.[0]?.price?.id || null,
        status: subscription?.status || null, tier: entitled ? getTierFromSubscription(subscription) : 'free',
        activated_at: entitled ? new Date(subscription.created * 1000).toISOString() : null };
      await rpc(admin, 'finish_billing_webhook', { p_event_id: event.id, p_customer_id: customerId,
        p_lease_token: lease, p_athlete_id: athlete?.id || null, p_snapshot: athlete ? snapshot : null });
      return res.status(200).json({ received: true });
    } catch (error) {
      // Stripe must retry provider/database failures, including a missing migration.
      if (admin && lease) {
        try { await rpc(admin, 'release_billing_webhook', { p_customer_id: customerId, p_lease_token: lease }); } catch { /* lease expires */ }
      }
      console.error('[billing/webhook] processing failed:', { code: error?.code, type: error?.type || error?.name });
      return res.status(503).json({ error: 'Could not process billing event. Please retry.' });
    }
  };
}
export default createBillingWebhookHandler();
