export const BILLING_PLANS = {
  research_monthly: {
    id: 'research_monthly',
    tier: 'research',
    label: 'Research Feed Monthly',
    envKeys: ['STRIPE_PRICE_RESEARCH_MONTHLY', 'STRIPE_PRICE_RESEARCH'],
  },
  individual_monthly: {
    id: 'individual_monthly',
    tier: 'individual',
    label: 'Individual Monthly',
    envKeys: ['STRIPE_PRICE_INDIVIDUAL_MONTHLY', 'STRIPE_PRICE_INDIVIDUAL'],
    // Earlier price points that may still be attached to live subscriptions.
    legacyPriceIds: ['price_1TG9MNLs6h9nimdMijXTxWpC'],
  },
  individual_annual: {
    id: 'individual_annual',
    tier: 'individual',
    label: 'Individual Annual',
    envKeys: ['STRIPE_PRICE_INDIVIDUAL_ANNUAL'],
    legacyPriceIds: ['price_1TG9MOLs6h9nimdMmgLvmC23'],
  },
  coach_monthly: {
    id: 'coach_monthly',
    tier: 'coach',
    label: 'Coach Monthly',
    envKeys: ['STRIPE_PRICE_COACH_MONTHLY', 'STRIPE_PRICE_COACH'],
  },
  coach_annual: {
    id: 'coach_annual',
    tier: 'coach',
    label: 'Coach Annual',
    envKeys: ['STRIPE_PRICE_COACH_ANNUAL'],
  },
};

export function getBillingPlan(planId) {
  return BILLING_PLANS[planId] || null;
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
  if (metadataTier) return metadataTier;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  return getTierFromPriceId(priceId);
}
