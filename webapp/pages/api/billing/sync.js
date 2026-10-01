import { getAthleteByCookie, getSupabaseAdminClient } from '../../../lib/authServer.js';
import { getTierFromSubscription, isEntitledSubscriptionStatus } from '../../../lib/billingPlans.js';
import { getStripeClient } from '../../../lib/stripeServer.js';
import { requireBillingPost } from '../../../lib/billingSecurity.js';
import cookie from 'cookie';
import { appendSetCookie } from '../../../lib/auth/sessionCookies.js';

const stripeId = value => typeof value === 'string' ? value : value?.id || null;

export function createBillingSyncHandler({ getClient = getSupabaseAdminClient,
  getAthlete = getAthleteByCookie, getStripe = getStripeClient } = {}) {
  return async function handler(req, res) {
    try {
      if (!requireBillingPost(req, res)) return;
      const admin = getClient();
      // A pending checkout cookie must never restore a logged-out/revoked session.
      const athlete = await getAthlete(req, admin);
      if (!athlete) return res.status(401).json({ error: 'Please log in to refresh billing.' });
      const stripe = getStripe();
      const sessionId = req.body?.sessionId || null;
      let customerId = athlete.stripe_customer_id;
      let subscription;
      if (sessionId) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.mode !== 'subscription' || session.metadata?.athlete_id !== athlete.id
            || (session.client_reference_id && session.client_reference_id !== athlete.id)) {
          return res.status(403).json({ error: 'Checkout does not belong to this account.' });
        }
        if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) {
          return res.status(200).json({ synced: false, pending: true });
        }
        const sessionCustomer = stripeId(session.customer);
        if (!sessionCustomer || (customerId && customerId !== sessionCustomer)) {
          return res.status(403).json({ error: 'Checkout does not belong to this account.' });
        }
        customerId = sessionCustomer;
        const id = stripeId(session.subscription);
        if (id) subscription = await stripe.subscriptions.retrieve(id, { expand: ['items.data.price'] });
      } else if (customerId) {
        const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
        const live = list.data.filter(s => !['canceled', 'incomplete_expired'].includes(s.status));
        if (list.has_more || live.length > 1) throw new Error('Ambiguous subscriptions.');
        subscription = live[0] || list.data[0];
      }
      if (!customerId || !subscription) return res.status(200).json({ synced: false });
      if (stripeId(subscription.customer) !== customerId
          || (subscription.metadata?.athlete_id && subscription.metadata.athlete_id !== athlete.id)) {
        return res.status(403).json({ error: 'Billing does not belong to this account.' });
      }
      const entitled = isEntitledSubscriptionStatus(subscription.status);
      const { data, error } = await admin.from('athletes').update({
        stripe_customer_id: customerId, stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items?.data?.[0]?.price?.id || null,
        stripe_subscription_status: subscription.status,
        subscription_tier: entitled ? getTierFromSubscription(subscription) : 'free',
        subscription_activated_at: entitled ? new Date(subscription.created * 1000).toISOString() : null,
      }).eq('id', athlete.id)
        .select('id, subscription_tier, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status')
        .single();
      if (error) throw error;
      for (const clearedCookie of [
        cookie.serialize('pending_checkout_session_id', '', { path: '/', maxAge: 0, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }),
        cookie.serialize('pending_billing_state', '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }),
      ]) appendSetCookie(res, clearedCookie);
      return res.status(200).json({ synced: true, athlete: data });
    } catch (error) {
      console.error('[billing/sync] failed:', { type: error?.type || error?.name, code: error?.code });
      return res.status(503).json({ error: 'Could not refresh billing status. Please try again.' });
    }
  };
}

export default createBillingSyncHandler();
