export const BILLING_PLANS = {
  research_monthly: {
    id: 'research_monthly',
    tier: 'research',
    label: 'Research Feed',
    envKey: 'STRIPE_PRICE_RESEARCH_MONTHLY',
  },
  individual_monthly: {
    id: 'individual_monthly',
    tier: 'individual',
    label: 'Individual Monthly',
    envKey: 'STRIPE_PRICE_INDIVIDUAL_MONTHLY',
  },
  individual_annual: {
    id: 'individual_annual',
    tier: 'individual',
    label: 'Individual Annual',
    envKey: 'STRIPE_PRICE_INDIVIDUAL_ANNUAL',
  },
  coach_monthly: {
    id: 'coach_monthly',
    tier: 'coach',
    label: 'Coach Monthly',
    envKey: 'STRIPE_PRICE_COACH_MONTHLY',
  },
  coach_annual: {
    id: 'coach_annual',
    tier: 'coach',
    label: 'Coach Annual',
    envKey: 'STRIPE_PRICE_COACH_ANNUAL',
  },
};

export function getBillingPlan(planId) {
  return BILLING_PLANS[planId] || null;
}

export function getBillingPriceId(planId) {
  const plan = getBillingPlan(planId);
  if (!plan) return null;
  return process.env[plan.envKey] || null;
}

export function getBillingPlanFromPriceId(priceId) {
  if (!priceId) return null;
  return Object.values(BILLING_PLANS).find((plan) => process.env[plan.envKey] === priceId) || null;
}

export function getTierFromPriceId(priceId) {
  const match = getBillingPlanFromPriceId(priceId);
  return match?.tier || 'free';
}

export function getPlanIdFromPriceId(priceId) {
  return getBillingPlanFromPriceId(priceId)?.id || null;
}

export function getTierRank(tier) {
  switch (tier) {
    case 'coach':
      return 3;
    case 'individual':
      return 2;
    case 'research':
      return 1;
    default:
      return 0;
  }
}

export function getTierFromSubscription(subscription) {
  const metadataTier = subscription?.metadata?.subscription_tier || subscription?.metadata?.tier || null;
  if (metadataTier && getTierRank(metadataTier) > 0) {
    return metadataTier;
  }

  const primaryItem = subscription?.items?.data?.[0];
  const priceId = primaryItem?.price?.id || null;
  return getTierFromPriceId(priceId);
}
