import { getAthleteByCookie, getSupabaseAdminClient, setAthleteCookie } from '../../../lib/authServer';
import { getTierFromPriceId } from '../../../lib/billingPlans';
import { getStripeClient } from '../../../lib/stripeServer';
import { supabase } from '../../../lib/supabaseClient';
import cookie from 'cookie';
import crypto from 'crypto';

function isActiveSubscriptionStatus(status) {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

async function writeSubscriptionToAthlete({ athleteId, customerId, subscription }) {
  const admin = getSupabaseAdminClient();
  const primaryItem = subscription?.items?.data?.[0];
  const priceId = primaryItem?.price?.id || null;
  const tier = getTierFromPriceId(priceId);
  const isPaid = isActiveSubscriptionStatus(subscription?.status);

  const updates = {
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscription?.id || null,
    stripe_price_id: priceId,
    stripe_subscription_status: subscription?.status || null,
    subscription_tier: isPaid ? tier : 'free',
    subscription_activated_at: isPaid
      ? new Date(subscription.created * 1000).toISOString()
      : null,
  };

  const { data, error } = await admin
    .from('athletes')
    .update(updates)
    .eq('id', athleteId)
    .select('id, subscription_tier, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function findCustomerIdForAthlete(stripe, athlete) {
  if (athlete.stripe_customer_id) {
    return athlete.stripe_customer_id;
  }

  if (!athlete.email) {
    return null;
  }

  const customers = await stripe.customers.list({
    email: athlete.email,
    limit: 1,
  });

  return customers.data?.[0]?.id || null;
}

async function findLatestRelevantSubscription(stripe, customerId) {
  if (!customerId) {
    return null;
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });

  return subscriptions.data.find((subscription) => isActiveSubscriptionStatus(subscription.status))
    || subscriptions.data[0]
    || null;
}

function clearPendingCheckoutCookie(res) {
  const cookiesToSet = [
    cookie.serialize('pending_checkout_session_id', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    }),
    cookie.serialize('pending_billing_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    }),
  ];

  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', cookiesToSet);
    return;
  }

  const existing = Array.isArray(current) ? current : [current];
  res.setHeader('Set-Cookie', [...existing, ...cookiesToSet]);
}

function verifyPendingBillingState(value) {
  if (!value) return null;

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  const [encodedPayload, providedSignature] = value.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const recoveryState = verifyPendingBillingState(cookies.pending_billing_state);
    const athlete = await getAthleteByCookie(req, supabase);
    const athleteId = athlete?.id || recoveryState?.athleteId || null;
    if (!athleteId) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }

    const stripe = getStripeClient();
    const sessionId = req.body?.sessionId || recoveryState?.sessionId || cookies.pending_checkout_session_id || null;
    let customerId = null;
    let subscription = null;

    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.athlete_id && session.metadata.athlete_id !== athleteId) {
        res.status(403).json({ error: 'Checkout session does not belong to this account.' });
        return;
      }

      customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;

      if (session.subscription) {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
        subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        });
      }
    }

    if (!customerId) {
      const athleteRecord = athlete || await getSupabaseAdminClient()
        .from('athletes')
        .select('*')
        .eq('id', athleteId)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data;
        });
      customerId = await findCustomerIdForAthlete(stripe, athleteRecord);
    }

    if (!subscription) {
      subscription = await findLatestRelevantSubscription(stripe, customerId);
    }

    if (!customerId || !subscription) {
      res.status(200).json({
        synced: false,
        athlete: {
          id: athleteId,
          subscription_tier: athlete?.subscription_tier || 'free',
          stripe_subscription_status: athlete?.stripe_subscription_status || null,
        },
      });
      return;
    }

    const updatedAthlete = await writeSubscriptionToAthlete({
      athleteId,
      customerId,
      subscription,
    });

    setAthleteCookie(res, athleteId);
    clearPendingCheckoutCookie(res);

    res.status(200).json({
      synced: true,
      athlete: updatedAthlete,
    });
  } catch (error) {
    console.error('[billing/sync] failed:', error);
    res.status(500).json({ error: 'Could not sync billing status.' });
  }
}
