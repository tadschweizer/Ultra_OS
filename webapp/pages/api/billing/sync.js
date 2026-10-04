import crypto from 'crypto';
import { getAthleteByCookie, getSupabaseAdminClient } from '../../../lib/authServer.js';
import { getTierFromSubscription, isEntitledSubscriptionStatus } from '../../../lib/billingPlans.js';
import { getStripeClient } from '../../../lib/stripeServer.js';
import { requireBillingPost } from '../../../lib/billingSecurity.js';
import cookie from 'cookie';
import { appendSetCookie } from '../../../lib/auth/sessionCookies.js';
const stripeId = value => typeof value === 'string' ? value : value?.id || null;
async function rpc(admin, name, args) { const result = await admin.rpc(name, args); if (result.error) throw result.error; return result.data; }
export function createBillingSyncHandler({ getClient = getSupabaseAdminClient,
  getAthlete = getAthleteByCookie, getStripe = getStripeClient } = {}) {
  return async function handler(req, res) {
    let admin; let customerId; let lease;
    try {
      if (!requireBillingPost(req, res)) return;
      admin = getClient();
      const athlete = await getAthlete(req, admin);
      if (!athlete) return res.status(401).json({ error: 'Please log in to refresh billing.' });
      const stripe = getStripe();
      customerId = athlete.stripe_customer_id;
      if (req.body?.sessionId) {
        const session = await stripe.checkout.sessions.retrieve(req.body.sessionId);
        if (session.mode !== 'subscription' || session.metadata?.athlete_id !== athlete.id
            || (session.client_reference_id && session.client_reference_id !== athlete.id)) {
          return res.status(403).json({ error: 'Checkout does not belong to this account.' });
        }
        if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) {
          return res.status(200).json({ synced: false, pending: true });
        }
        const sessionCustomer = stripeId(session.customer);
        if (!sessionCustomer || (customerId && customerId !== sessionCustomer)) return res.status(403).json({ error: 'Checkout does not belong to this account.' });
        customerId = sessionCustomer;
      }
      if (!customerId) return res.status(200).json({ synced: false });
      const eventId = `sync_${crypto.randomUUID()}`;
      const claim = await rpc(admin, 'claim_billing_webhook', { p_event_id: eventId, p_customer_id: customerId, p_event_type: 'threshold.billing_sync' });
      if (!claim?.lease_token) return res.status(503).json({ error: 'Billing is updating. Please retry in a few seconds.' });
      lease = claim.lease_token;
      // Sync and webhooks share the customer lease and atomic write, so a stale
      // return-page refresh cannot race a newer provider event.
      const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100, expand: ['data.items.data.price'] });
      const live = list.data.filter(s => !['canceled', 'incomplete_expired'].includes(s.status));
      if (list.has_more || live.length > 1) throw new Error('Ambiguous subscriptions.');
      const subscription = live[0] || list.data[0];
      if (subscription && (stripeId(subscription.customer) !== customerId
          || (subscription.metadata?.athlete_id && subscription.metadata.athlete_id !== athlete.id))) {
        await rpc(admin, 'release_billing_webhook', { p_customer_id: customerId, p_lease_token: lease });
        return res.status(403).json({ error: 'Billing does not belong to this account.' });
      }
      const entitled = isEntitledSubscriptionStatus(subscription?.status);
      await rpc(admin, 'finish_billing_webhook', { p_event_id: eventId, p_customer_id: customerId, p_lease_token: lease,
        p_athlete_id: athlete.id, p_snapshot: { subscription_id: subscription?.id || null,
          price_id: subscription?.items?.data?.[0]?.price?.id || null, status: subscription?.status || null,
          tier: entitled ? getTierFromSubscription(subscription) : 'free',
          activated_at: entitled ? new Date(subscription.created * 1000).toISOString() : null } });
      lease = null;
      const { data, error } = await admin.from('athletes')
        .select('id, subscription_tier, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status')
        .eq('id', athlete.id).single();
      if (error) throw error;
      for (const cleared of [
        cookie.serialize('pending_checkout_session_id', '', { path: '/', maxAge: 0, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }),
        cookie.serialize('pending_billing_state', '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }),
      ]) appendSetCookie(res, cleared);
      return res.status(200).json({ synced: true, athlete: data });
    } catch (error) {
      if (admin && customerId && lease) { try { await rpc(admin, 'release_billing_webhook', { p_customer_id: customerId, p_lease_token: lease }); } catch { /* expires */ } }
      console.error('[billing/sync] failed:', { type: error?.type || error?.name, code: error?.code });
      return res.status(503).json({ error: 'Could not refresh billing status. Please try again.' });
    }
  };
}
export default createBillingSyncHandler();
