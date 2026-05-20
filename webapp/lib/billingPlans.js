export const BILLING_PLANS = {
  individual_monthly: {
    id: 'individual_monthly',
    tier: 'individual',
    label: 'Individual Monthly',
    envKeys: ['STRIPE_PRICE_INDIVIDUAL_MONTHLY', 'STRIPE_PRICE_INDIVIDUAL'],
  },
  individual_annual: {
    id: 'individual_annual',
    tier: 'individual',
    label: 'Individual Annual',
    envKeys: ['STRIPE_PRICE_INDIVIDUAL_ANNUAL'],
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

export function getBillingPriceId(planId) {
  const plan = getBillingPlan(planId);
  if (!plan) return null;
  for (const envKey of plan.envKeys || []) {
    if (process.env[envKey]) {
      return process.env[envKey];
    }
  }
  return null;
}

export function getTierFromPriceId(priceId) {
  const match = Object.values(BILLING_PLANS).find((plan) =>
    (plan.envKeys || []).some((envKey) => process.env[envKey] === priceId)
  );
  return match?.tier || 'free';
}
