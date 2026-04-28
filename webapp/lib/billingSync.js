import { getStripeClient } from './stripeServer';
import { getTierFromSubscription, getTierRank } from './billingPlans';
import { getSupabaseAdminClient } from './authServer';
import { normalizeSubscriptionTier } from './subscriptionTiers';

export function isActiveSubscriptionStatus(status) {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

function normalizeAthleteRecord(athlete) {
  if (!athlete) return athlete;
  return {
    ...athlete,
    subscription_tier: normalizeSubscriptionTier(athlete.subscription_tier),
  };
}

async function findCustomerIdForAthlete(stripe, athlete) {
  if (athlete?.stripe_customer_id) {
    return athlete.stripe_customer_id;
  }

  if (!athlete?.email) {
    return null;
  }

  const customers = await stripe.customers.list({
    email: athlete.email,
    limit: 1,
  });

  return customers.data?.[0]?.id || null;
}

async function findLatestRelevantSubscription(stripe, athlete, customerId) {
  if (athlete?.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(athlete.stripe_subscription_id, {
        expand: ['items.data.price'],
      });
      if (subscription) {
        return subscription;
      }
    } catch (error) {
      console.warn('[billingSync] could not retrieve saved Stripe subscription:', error.message);
    }
  }

  if (!customerId) {
    return null;
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
  });

  const activeSubscriptions = subscriptions.data.filter((subscription) => isActiveSubscriptionStatus(subscription.status));

  if (activeSubscriptions.length) {
    return [...activeSubscriptions].sort((left, right) => {
      const tierDelta = getTierRank(getTierFromSubscription(right)) - getTierRank(getTierFromSubscription(left));
      if (tierDelta !== 0) return tierDelta;
      return (right.created || 0) - (left.created || 0);
    })[0];
  }

  return subscriptions.data[0] || null;
}

async function writeSubscriptionToAthlete({ athleteId, customerId, subscription }) {
  const admin = getSupabaseAdminClient();
  const primaryItem = subscription?.items?.data?.[0];
  const priceId = primaryItem?.price?.id || null;
  const isPaid = isActiveSubscriptionStatus(subscription?.status);
  const resolvedTier = getTierFromSubscription(subscription);

  const { data, error } = await admin
    .from('athletes')
    .update({
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscription?.id || null,
      stripe_price_id: priceId,
      stripe_subscription_status: subscription?.status || null,
      subscription_tier: isPaid ? resolvedTier : 'free',
      subscription_activated_at: isPaid
        ? new Date(subscription.created * 1000).toISOString()
        : null,
    })
    .eq('id', athleteId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeAthleteRecord(data);
}

function shouldAttemptBillingRestore(athlete, force) {
  if (!athlete) {
    return false;
  }

  if (force) {
    return true;
  }

  const currentTier = normalizeSubscriptionTier(athlete.subscription_tier);
  if (currentTier !== 'free' && isActiveSubscriptionStatus(athlete.stripe_subscription_status)) {
    return false;
  }

  return Boolean(athlete.stripe_customer_id || athlete.stripe_subscription_id || athlete.email);
}

export async function syncAthleteSubscriptionFromStripe({ athlete, force = false }) {
  const normalizedAthlete = normalizeAthleteRecord(athlete);
  if (!shouldAttemptBillingRestore(normalizedAthlete, force)) {
    return normalizedAthlete;
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (error) {
    console.warn('[billingSync] Stripe client unavailable:', error.message);
    return normalizedAthlete;
  }

  const customerId = await findCustomerIdForAthlete(stripe, normalizedAthlete);
  const subscription = await findLatestRelevantSubscription(stripe, normalizedAthlete, customerId);

  if (!customerId || !subscription) {
    return normalizedAthlete;
  }

  return writeSubscriptionToAthlete({
    athleteId: normalizedAthlete.id,
    customerId,
    subscription,
  });
}
