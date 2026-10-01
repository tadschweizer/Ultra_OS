/**
 * Plan tiers and the features each one unlocks. This file is the single source
 * of truth for plan gating: pages and API routes ask `hasFeature`, never compare
 * tier strings directly.
 *
 * Athlete plans: free → core → pro. Coach plans: coach_essentials → coach_pro.
 * Pro tiers are deterministic analytics only at launch; AI analysis is listed
 * in COMING_SOON_FEATURES and is granted to no tier until it ships.
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    label: 'Free',
    audience: 'athlete',
    rank: 0,
  },
  core: {
    id: 'core',
    label: 'Athlete Core',
    audience: 'athlete',
    rank: 1,
  },
  pro: {
    id: 'pro',
    label: 'Athlete Pro',
    audience: 'athlete',
    rank: 2,
  },
  coach_essentials: {
    id: 'coach_essentials',
    label: 'Coach Essentials',
    audience: 'coach',
    rank: 1,
    includedAthletes: 10,
  },
  coach_pro: {
    id: 'coach_pro',
    label: 'Coach Pro',
    audience: 'coach',
    rank: 2,
    includedAthletes: 25,
  },
};

// Tier values written by earlier pricing. Existing subscribers keep at least
// what they paid for: Research Feed ($7) → Core, Individual → Pro, Coach → Coach Pro.
export const LEGACY_TIER_ALIASES = {
  research: 'core',
  research_feed: 'core',
  individual: 'pro',
  coach: 'coach_pro',
};

export const COACH_TIERS = Object.freeze(['coach_essentials', 'coach_pro']);
export const PAID_ATHLETE_TIERS = Object.freeze(['core', 'pro']);

export const FREE_INTERVENTION_LIMIT = 15;
export const FREE_WEEKLY_CHECKIN_LIMIT = 3;

const CORE_FEATURES = [
  'unlimited_interventions',
  'unlimited_checkins',
  'volume_trends',
];

const PRO_FEATURES = [
  ...CORE_FEATURES,
  'fitness_fatigue',
  'steady_state_analysis',
  'training_correlations',
  'explorer',
  'race_blueprint',
];

const COACH_ESSENTIALS_FEATURES = [
  ...CORE_FEATURES,
  'coach_workspace',
];

// Coach Pro keeps Pro for the coach's own training so legacy Coach subscribers
// (who had the full Individual toolkit) lose nothing.
const COACH_PRO_FEATURES = [
  ...PRO_FEATURES,
  'coach_workspace',
  'coach_advanced_metrics',
];

// The closed pilot grants coach tools only, not the coach's own athlete plan.
const COACH_PILOT_FEATURES = ['coach_workspace', 'coach_advanced_metrics'];

export const TIER_FEATURES = {
  free: [],
  core: CORE_FEATURES,
  pro: PRO_FEATURES,
  coach_essentials: COACH_ESSENTIALS_FEATURES,
  coach_pro: COACH_PRO_FEATURES,
};

// Announced on the pricing page but not granted to any tier yet.
export const COMING_SOON_FEATURES = Object.freeze(['ai_analysis', 'coach_ai']);

export const FEATURE_UNLOCK_LABELS = {
  unlimited_interventions: 'Athlete Core',
  unlimited_checkins: 'Athlete Core',
  volume_trends: 'Athlete Core',
  fitness_fatigue: 'Athlete Pro',
  steady_state_analysis: 'Athlete Pro',
  training_correlations: 'Athlete Pro',
  explorer: 'Athlete Pro',
  race_blueprint: 'Athlete Pro',
  coach_workspace: 'Coach Essentials',
  coach_advanced_metrics: 'Coach Pro',
};

export function normalizeSubscriptionTier(value) {
  const raw = String(value || '').trim().toLowerCase();
  const tier = LEGACY_TIER_ALIASES[raw] || raw;
  if (tier in SUBSCRIPTION_TIERS) return tier;
  return 'free';
}

export function isKnownTier(value) {
  return typeof value === 'string' && value in SUBSCRIPTION_TIERS;
}

export function getSubscriptionTierLabel(value) {
  return SUBSCRIPTION_TIERS[normalizeSubscriptionTier(value)].label;
}

export function isPaidTier(value) {
  return normalizeSubscriptionTier(value) !== 'free';
}

export function isCoachTier(value) {
  return COACH_TIERS.includes(normalizeSubscriptionTier(value));
}

export function getIncludedAthletes(value) {
  return SUBSCRIPTION_TIERS[normalizeSubscriptionTier(value)].includedAthletes ?? null;
}

/**
 * The features an account can use. `linkedToPaidCoach` grants Core to athletes
 * coached on a paid coach plan; `coachPilot` grants Coach Pro's coach tools to
 * an approved pilot coach without changing their stored tier.
 */
export function getFeatureSet(tier, { linkedToPaidCoach = false, coachPilot = false } = {}) {
  const features = new Set(TIER_FEATURES[normalizeSubscriptionTier(tier)]);
  if (linkedToPaidCoach) CORE_FEATURES.forEach((feature) => features.add(feature));
  if (coachPilot) COACH_PILOT_FEATURES.forEach((feature) => features.add(feature));
  return features;
}

export function getFeatureList(tier, options) {
  return [...getFeatureSet(tier, options)].sort();
}

export function hasFeature(athlete, feature, options) {
  return getFeatureSet(athlete?.subscription_tier, options).has(feature);
}

export function getUnlockLabel(feature) {
  return FEATURE_UNLOCK_LABELS[feature] || 'a paid plan';
}

export function canLogIntervention(athlete, currentInterventionCount, options) {
  if (hasFeature(athlete, 'unlimited_interventions', options)) return { allowed: true };
  if (currentInterventionCount >= FREE_INTERVENTION_LIMIT) {
    return {
      allowed: false,
      reason: `Free accounts can log up to ${FREE_INTERVENTION_LIMIT} interventions. Upgrade to Athlete Core for unlimited logging.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

/**
 * When an entitlement is supplied it is authoritative for paid tiers: it already
 * folds in Stripe status, so a paid tier whose subscription lapsed stays capped.
 */
export function canLogCheckIn(athlete, currentWeeklyCheckIns, entitlement = null) {
  if (entitlement?.unlimited === true) return { allowed: true };
  if (checkInsUncapped(athlete, entitlement)) return { allowed: true };
  if (currentWeeklyCheckIns >= FREE_WEEKLY_CHECKIN_LIMIT) {
    return {
      allowed: false,
      reason: `Free accounts can log ${FREE_WEEKLY_CHECKIN_LIMIT} check-ins per week. Upgrade to Athlete Core for unlimited check-ins.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

function checkInsUncapped(athlete, entitlement) {
  const tier = normalizeSubscriptionTier(athlete?.subscription_tier);
  if (entitlement && tier !== 'free') return false;
  return hasFeature(athlete, 'unlimited_checkins');
}

export function canAccessFullInsights(athlete, options) {
  return { allowed: hasFeature(athlete, 'training_correlations', options) };
}

export function canAccessRaceBlueprint(athlete, options) {
  return { allowed: hasFeature(athlete, 'race_blueprint', options) };
}

export function canAccessExplorer(athlete, options) {
  return { allowed: hasFeature(athlete, 'explorer', options) };
}

export function hasCoachFeatures(athlete) {
  return { allowed: isCoachTier(athlete?.subscription_tier) };
}

export function buildUsageSnapshot({ athlete, interventionCount = 0, weeklyCheckIns = 0, checkInEntitlement = null, featureOptions }) {
  const interventionsCapped = !hasFeature(athlete, 'unlimited_interventions', featureOptions);
  const cappedCheckIns = !checkInEntitlement?.unlimited && !checkInsUncapped(athlete, checkInEntitlement);
  return {
    interventionsUsed: interventionCount,
    interventionsLimit: interventionsCapped ? FREE_INTERVENTION_LIMIT : null,
    weeklyCheckInsUsed: weeklyCheckIns,
    weeklyCheckInsLimit: cappedCheckIns ? FREE_WEEKLY_CHECKIN_LIMIT : null,
    checkInAccessSource: checkInEntitlement?.source || 'own_plan',
    checkInsUnlimited: checkInEntitlement?.unlimited === true,
    atInterventionLimit: interventionsCapped && interventionCount >= FREE_INTERVENTION_LIMIT,
    atCheckInLimit: Boolean(cappedCheckIns && weeklyCheckIns >= FREE_WEEKLY_CHECKIN_LIMIT),
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
