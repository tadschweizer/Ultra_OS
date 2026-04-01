export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    label: 'Free',
    checkoutProduct: null,
  },
  research: {
    id: 'research',
    label: 'Research Feed',
    checkoutProduct: 'research_feed',
  },
  individual: {
    id: 'individual',
    label: 'Individual',
    checkoutProduct: 'individual',
  },
  coach: {
    id: 'coach',
    label: 'Coach',
    checkoutProduct: 'coach',
  },
};

export const FREE_INTERVENTION_LIMIT = 15;
export const FREE_WEEKLY_CHECKIN_LIMIT = 3;

export function normalizeSubscriptionTier(value) {
  const tier = String(value || '').trim().toLowerCase();
  if (tier === 'research_feed') return 'research';
  if (tier in SUBSCRIPTION_TIERS) return tier;
  return 'free';
}

export function getSubscriptionTierLabel(value) {
  const tier = normalizeSubscriptionTier(value);
  return SUBSCRIPTION_TIERS[tier].label;
}

export function isPaidTier(value) {
  return normalizeSubscriptionTier(value) !== 'free';
}

export function canLogIntervention(athlete, currentInterventionCount) {
  const tier = normalizeSubscriptionTier(athlete?.subscription_tier);
  if (tier === 'individual' || tier === 'coach') {
    return { allowed: true };
  }
  if (tier === 'research') {
    return {
      allowed: false,
      reason: 'Research Feed does not include intervention logging. Upgrade to Individual to start logging protocols.',
      upgradeRequired: true,
    };
  }
  if (currentInterventionCount >= FREE_INTERVENTION_LIMIT) {
    return {
      allowed: false,
      reason: `Free accounts can log up to ${FREE_INTERVENTION_LIMIT} interventions. Upgrade to Individual for unlimited logging.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

export function canLogCheckIn(athlete, currentWeeklyCheckIns) {
  const tier = normalizeSubscriptionTier(athlete?.subscription_tier);
  if (tier === 'individual' || tier === 'coach') {
    return { allowed: true };
  }
  if (tier === 'research') {
    return {
      allowed: false,
      reason: 'Research Feed does not include workout check-ins. Upgrade to Individual to track training response.',
      upgradeRequired: true,
    };
  }
  if (currentWeeklyCheckIns >= FREE_WEEKLY_CHECKIN_LIMIT) {
    return {
      allowed: false,
      reason: `Free accounts can log ${FREE_WEEKLY_CHECKIN_LIMIT} check-ins per week. Upgrade to Individual for unlimited check-ins.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

export function canAccessFullInsights(athlete) {
  const tier = normalizeSubscriptionTier(athlete?.subscription_tier);
  return { allowed: tier === 'individual' || tier === 'coach' };
}

export function canAccessRaceBlueprint(athlete) {
  const tier = normalizeSubscriptionTier(athlete?.subscription_tier);
  return { allowed: tier === 'individual' || tier === 'coach' };
}

export function canAccessExplorer(athlete) {
  const tier = normalizeSubscriptionTier(athlete?.subscription_tier);
  return { allowed: tier === 'individual' || tier === 'coach' };
}

export function hasCoachFeatures(athlete) {
  return { allowed: normalizeSubscriptionTier(athlete?.subscription_tier) === 'coach' };
}

export function buildUsageSnapshot({ athlete, interventionCount = 0, weeklyCheckIns = 0 }) {
  const tier = normalizeSubscriptionTier(athlete?.subscription_tier);
  const isFree = tier === 'free';
  return {
    interventionsUsed: interventionCount,
    interventionsLimit: isFree ? FREE_INTERVENTION_LIMIT : null,
    weeklyCheckInsUsed: weeklyCheckIns,
    weeklyCheckInsLimit: isFree ? FREE_WEEKLY_CHECKIN_LIMIT : null,
    atInterventionLimit: isFree && interventionCount >= FREE_INTERVENTION_LIMIT,
    atCheckInLimit: isFree && weeklyCheckIns >= FREE_WEEKLY_CHECKIN_LIMIT,
  };
}

export function interventionAllowanceLabel(usage) {
  if (!usage?.interventionsLimit) return null;
  const remaining = Math.max(0, usage.interventionsLimit - usage.interventionsUsed);
  return `${remaining} of ${usage.interventionsLimit} free interventions remaining`;
}

export function checkInAllowanceLabel(usage) {
  if (!usage?.weeklyCheckInsLimit) return null;
  const remaining = Math.max(0, usage.weeklyCheckInsLimit - usage.weeklyCheckInsUsed);
  return `${remaining} of ${usage.weeklyCheckInsLimit} free check-ins remaining this week`;
}
