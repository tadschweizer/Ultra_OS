import { isCoachTier, normalizeSubscriptionTier } from './subscriptionTiers.js';

/**
 * Purchasable plans. `legacy` plans are no longer sold but stay listed so
 * existing subscriptions on their prices keep resolving to a tier (their old
 * tier values are mapped forward by normalizeSubscriptionTier).
 */
export const BILLING_PLANS = {
  core_monthly: {
    id: 'core_monthly',
    tier: 'core',
    label: 'Athlete Core Monthly',
    envKeys: ['STRIPE_PRICE_CORE_MONTHLY'],
  },
  core_annual: {
    id: 'core_annual',
    tier: 'core',
    label: 'Athlete Core Annual',
    envKeys: ['STRIPE_PRICE_CORE_ANNUAL'],
  },
  pro_monthly: {
    id: 'pro_monthly',
    tier: 'pro',
    label: 'Athlete Pro Monthly',
    envKeys: ['STRIPE_PRICE_PRO_MONTHLY'],
  },
  pro_annual: {
    id: 'pro_annual',
    tier: 'pro',
    label: 'Athlete Pro Annual',
    envKeys: ['STRIPE_PRICE_PRO_ANNUAL'],
  },
  coach_essentials_monthly: {
    id: 'coach_essentials_monthly',
    tier: 'coach_essentials',
    label: 'Coach Essentials Monthly',
    envKeys: ['STRIPE_PRICE_COACH_ESSENTIALS_MONTHLY'],
  },
  coach_essentials_annual: {
    id: 'coach_essentials_annual',
    tier: 'coach_essentials',
    label: 'Coach Essentials Annual',
    envKeys: ['STRIPE_PRICE_COACH_ESSENTIALS_ANNUAL'],
  },
  coach_pro_monthly: {
    id: 'coach_pro_monthly',
    tier: 'coach_pro',
    label: 'Coach Pro Monthly',
    envKeys: ['STRIPE_PRICE_COACH_PRO_MONTHLY'],
  },
  coach_pro_annual: {
    id: 'coach_pro_annual',
    tier: 'coach_pro',
    label: 'Coach Pro Annual',
    envKeys: ['STRIPE_PRICE_COACH_PRO_ANNUAL'],
  },
  research_monthly: {
    id: 'research_monthly',
    tier: 'core',
    label: 'Research Feed Monthly (legacy)',
    legacy: true,
    envKeys: ['STRIPE_PRICE_RESEARCH_MONTHLY', 'STRIPE_PRICE_RESEARCH'],
  },
  individual_monthly: {
    id: 'individual_monthly',
    tier: 'pro',
    label: 'Individual Monthly (legacy)',
    legacy: true,
    envKeys: ['STRIPE_PRICE_INDIVIDUAL_MONTHLY', 'STRIPE_PRICE_INDIVIDUAL'],
    // Earlier price points that may still be attached to live subscriptions.
    legacyPriceIds: ['price_1TG9MNLs6h9nimdMijXTxWpC'],
  },
  individual_annual: {
    id: 'individual_annual',
    tier: 'pro',
    label: 'Individual Annual (legacy)',
    legacy: true,
    envKeys: ['STRIPE_PRICE_INDIVIDUAL_ANNUAL'],
    legacyPriceIds: ['price_1TG9MOLs6h9nimdMmgLvmC23'],
  },
  coach_monthly: {
    id: 'coach_monthly',
    tier: 'coach_pro',
    label: 'Coach Monthly (legacy)',
    legacy: true,
    envKeys: ['STRIPE_PRICE_COACH_MONTHLY', 'STRIPE_PRICE_COACH'],
  },
  coach_annual: {
    id: 'coach_annual',
    tier: 'coach_pro',
    label: 'Coach Annual (legacy)',
    legacy: true,
    envKeys: ['STRIPE_PRICE_COACH_ANNUAL'],
  },
};

export function getBillingPlan(planId) {
  return BILLING_PLANS[planId] || null;
}

/**
 * Returns the same-site checkout destination allowed to survive public signup.
 * Coach billing stays out of this path while the coach product is a closed,
 * administrator-approved pilot, and legacy plans are no longer sold.
 */
export function getPublicCheckoutPath(planId) {
  const plan = getBillingPlan(planId);
  if (!plan || plan.legacy || isCoachTier(plan.tier)) return null;
  return `/api/billing/checkout?plan=${encodeURIComponent(plan.id)}`;
}

export function normalizeStripePriceId(priceId) {
  return typeof priceId === 'string' ? priceId.trim() : priceId;
}

export function getBillingPriceId(planId) {
  const plan = getBillingPlan(planId);
  if (!plan) return null;
  for (const envKey of plan.envKeys || []) {
    const priceId = normalizeStripePriceId(process.env[envKey]);
    if (priceId) {
      return priceId;
    }
  }
  return null;
}

export function getTierFromPriceId(priceId) {
  const normalizedPriceId = normalizeStripePriceId(priceId);
  if (!normalizedPriceId) return 'free';
  const match = Object.values(BILLING_PLANS).find(
    (plan) =>
      (plan.envKeys || []).some(
        (envKey) => normalizeStripePriceId(process.env[envKey]) === normalizedPriceId
      ) ||
      (plan.legacyPriceIds || []).includes(normalizedPriceId)
  );
  return match?.tier || 'free';
}

/**
 * Single source of truth for which Stripe subscription statuses keep paid
 * features unlocked. `past_due` is included as a grace period so a failed
 * card does not instantly lock a paying customer out mid-renewal.
 */
export function isEntitledSubscriptionStatus(status) {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

/**
 * Resolve the tier for a Stripe subscription object, preferring the metadata
 * written at checkout and falling back to price-id lookup.
 */
export function getTierFromSubscription(subscription) {
  if (!subscription) return 'free';
  const metadataTier = subscription.metadata?.subscription_tier;
  if (metadataTier) return normalizeSubscriptionTier(metadataTier);
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  return getTierFromPriceId(priceId);
}
