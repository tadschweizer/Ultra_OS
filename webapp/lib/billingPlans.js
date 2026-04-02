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

export function getTierFromPriceId(priceId) {
  const match = Object.values(BILLING_PLANS).find((plan) => process.env[plan.envKey] === priceId);
  return match?.tier || 'free';
}
