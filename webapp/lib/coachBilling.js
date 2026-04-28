import { getBillingPlan, getBillingPriceId, getPlanIdFromPriceId } from './billingPlans';
import { getSupabaseAdminClient } from './authServer';
import { getStripeClient } from './stripeServer';

export const COACH_SEAT_LIMIT_MESSAGE = "You've reached your 25-athlete limit. Contact us to add more seats.";

export function formatStripeTimestamp(value) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

export function normalizeCoachSubscriptionStatus(subscription, eventType = null) {
  if (!subscription) {
    return 'inactive';
  }

  const currentPeriodEndMs = subscription.current_period_end
    ? subscription.current_period_end * 1000
    : 0;
  const stillInAccessWindow = currentPeriodEndMs > Date.now();

  if (eventType === 'deleted' || subscription.status === 'canceled') {
    return stillInAccessWindow ? 'cancelled' : 'inactive';
  }

  if (subscription.status === 'past_due' || eventType === 'payment_failed') {
    return 'past_due';
  }

  if (subscription.cancel_at_period_end) {
    return 'cancelled';
  }

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return 'active';
  }

  return 'inactive';
}

export function coachSubscriptionHasAccess(profile) {
  const status = profile?.subscription_status || 'inactive';
  if (status === 'active' || status === 'past_due') {
    return true;
  }

  if (status !== 'cancelled') {
    return false;
  }

  if (!profile?.subscription_current_period_end) {
    return false;
  }

  return new Date(profile.subscription_current_period_end).getTime() > Date.now();
}

export function getCoachPlanPresentation(planId) {
  const plan = getBillingPlan(planId);
  if (!plan) {
    return {
      id: 'coach_monthly',
      label: 'Coach Monthly',
      priceLabel: '$59.99/month',
      cycleLabel: 'Monthly',
    };
  }

  if (plan.id === 'coach_annual') {
    return {
      id: plan.id,
      label: 'Coach Annual',
      priceLabel: '$509.99/year',
      cycleLabel: 'Annual',
    };
  }

  return {
    id: plan.id,
    label: 'Coach Monthly',
    priceLabel: '$59.99/month',
    cycleLabel: 'Monthly',
  };
}

export async function countActiveCoachSeats(admin, coachId) {
  const { count, error } = await admin
    .from('coach_athlete_relationships')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function buildCoachSeatSnapshot(admin, profile) {
  const activeSeats = await countActiveCoachSeats(admin, profile.id);
  const maxSeats = Number(profile?.max_athletes || 25);
  const remainingSeats = Math.max(maxSeats - activeSeats, 0);

  return {
    activeSeats,
    maxSeats,
    remainingSeats,
    usageRatio: maxSeats > 0 ? activeSeats / maxSeats : 0,
    approachingLimit: maxSeats > 0 ? activeSeats / maxSeats >= 0.8 : false,
    atLimit: activeSeats >= maxSeats,
  };
}

export async function assertCoachSeatAvailable(admin, profile, { allowExistingAthleteId = null } = {}) {
  if (allowExistingAthleteId) {
    const { data: existingRelationship, error } = await admin
      .from('coach_athlete_relationships')
      .select('id, status')
      .eq('coach_id', profile.id)
      .eq('athlete_id', allowExistingAthleteId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (existingRelationship?.status === 'active') {
      return buildCoachSeatSnapshot(admin, profile);
    }
  }

  const seatSnapshot = await buildCoachSeatSnapshot(admin, profile);
  if (seatSnapshot.atLimit) {
    const error = new Error(COACH_SEAT_LIMIT_MESSAGE);
    error.code = 'coach_seat_limit_reached';
    error.statusCode = 409;
    error.seatSnapshot = seatSnapshot;
    throw error;
  }

  return seatSnapshot;
}

async function updateCoachProfileByAthleteId(admin, athleteId, updates) {
  const { data, error } = await admin
    .from('coach_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('athlete_id', athleteId)
    .select('id, athlete_id, display_name, coach_code, max_athletes, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_tier, subscription_current_period_end, subscription_cancel_at, subscription_cancel_at_period_end, created_at, updated_at')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getCoachProfileByAthleteId(admin, athleteId) {
  const { data, error } = await admin
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code, max_athletes, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_tier, subscription_current_period_end, subscription_cancel_at, subscription_cancel_at_period_end')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function lookupCoachProfileForSubscription(admin, subscription, customerId = null) {
  const athleteId = subscription?.metadata?.athlete_id || null;
  if (athleteId) {
    const { data, error } = await admin
      .from('coach_profiles')
      .select('id, athlete_id, display_name, coach_code, max_athletes, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_tier, subscription_current_period_end, subscription_cancel_at, subscription_cancel_at_period_end')
      .eq('athlete_id', athleteId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  if (subscription?.id) {
    const { data, error } = await admin
      .from('coach_profiles')
      .select('id, athlete_id, display_name, coach_code, max_athletes, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_tier, subscription_current_period_end, subscription_cancel_at, subscription_cancel_at_period_end')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  if (customerId) {
    const { data, error } = await admin
      .from('coach_profiles')
      .select('id, athlete_id, display_name, coach_code, max_athletes, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_tier, subscription_current_period_end, subscription_cancel_at, subscription_cancel_at_period_end')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  }

  return null;
}

export async function syncCoachProfileFromSubscription({
  athleteId = null,
  customerId = null,
  subscription,
  eventType = null,
}) {
  const admin = getSupabaseAdminClient();
  const coachProfile = athleteId
    ? await getCoachProfileByAthleteId(admin, athleteId).catch(() => null)
    : null;
  const profile = coachProfile || await lookupCoachProfileForSubscription(admin, subscription, customerId);

  if (!profile?.athlete_id) {
    return null;
  }

  const primaryItem = subscription?.items?.data?.[0];
  const priceId = primaryItem?.price?.id || null;
  const billingPlanId = subscription?.metadata?.billing_plan
    || getPlanIdFromPriceId(priceId)
    || profile.subscription_tier
    || 'coach_monthly';
  const status = normalizeCoachSubscriptionStatus(subscription, eventType);

  return updateCoachProfileByAthleteId(admin, profile.athlete_id, {
    stripe_customer_id: customerId || profile.stripe_customer_id || null,
    stripe_subscription_id: subscription?.id || null,
    stripe_price_id: priceId,
    subscription_status: status,
    subscription_tier: billingPlanId,
    subscription_current_period_end: formatStripeTimestamp(subscription?.current_period_end),
    subscription_cancel_at: formatStripeTimestamp(subscription?.cancel_at),
    subscription_cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
  });
}

export async function syncCoachProfileFromStripe({ athlete, profile, force = false }) {
  if (!profile?.athlete_id) {
    return profile;
  }

  if (!force && profile.stripe_subscription_id && profile.subscription_status !== 'inactive') {
    return profile;
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return profile;
  }

  let customerId = profile.stripe_customer_id || athlete?.stripe_customer_id || null;
  if (!customerId && athlete?.email) {
    const customers = await stripe.customers.list({
      email: athlete.email,
      limit: 1,
    });
    customerId = customers.data?.[0]?.id || null;
  }

  let subscription = null;
  if (profile.stripe_subscription_id) {
    try {
      subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
        expand: ['items.data.price'],
      });
    } catch {
      subscription = null;
    }
  }

  if (!subscription && customerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    subscription = subscriptions.data?.[0] || null;
  }

  if (!subscription) {
    return profile;
  }

  const synced = await syncCoachProfileFromSubscription({
    athleteId: profile.athlete_id,
    customerId,
    subscription,
  });

  return synced || profile;
}

export function getCoachSwitchTargetPlan(currentPlanId) {
  return currentPlanId === 'coach_annual' ? 'coach_monthly' : 'coach_annual';
}

export function getCoachPriceId(planId) {
  return getBillingPriceId(planId);
}
