/**
 * tierGates.js
 *
 * Server-side and client-side free tier enforcement.
 * Source of truth for what each subscription tier can access.
 *
 * Keep these limits in sync with /api/me.js.
 */

export const FREE_INTERVENTION_LIMIT = 15;    // lifetime total (all intervention types)
export const FREE_WEEKLY_CHECKIN_LIMIT = 3;   // Workout Check-ins in any rolling 7-day window
export const FREE_RESEARCH_TOPIC_LIMIT = 3;   // number of research topic filters unlocked

// ─── Server-side gate functions ───────────────────────────────────────────────
// These accept counts already fetched from the DB (passed in to avoid extra queries).

/**
 * @param {{ subscription_tier: string }} athlete
 * @param {number} currentInterventionCount
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canLogIntervention(athlete, currentInterventionCount) {
  const tier = athlete?.subscription_tier || 'free';
  if (tier !== 'free') return { allowed: true };
  if (currentInterventionCount >= FREE_INTERVENTION_LIMIT) {
    return {
      allowed: false,
      reason: `Free accounts can log up to ${FREE_INTERVENTION_LIMIT} interventions. Upgrade to Individual for unlimited logging.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

/**
 * @param {{ subscription_tier: string }} athlete
 * @param {number} currentWeeklyCheckIns
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canLogCheckIn(athlete, currentWeeklyCheckIns) {
  const tier = athlete?.subscription_tier || 'free';
  if (tier !== 'free') return { allowed: true };
  if (currentWeeklyCheckIns >= FREE_WEEKLY_CHECKIN_LIMIT) {
    return {
      allowed: false,
      reason: `Free accounts can log ${FREE_WEEKLY_CHECKIN_LIMIT} check-ins per week. Upgrade to Individual for unlimited check-ins.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

/**
 * @param {{ subscription_tier: string }} athlete
 * @returns {{ allowed: boolean }}
 */
export function canAccessFullInsights(athlete) {
  const tier = athlete?.subscription_tier || 'free';
  return { allowed: tier !== 'free' };
}

export function canAccessRaceBlueprint(athlete) {
  const tier = athlete?.subscription_tier || 'free';
  return { allowed: tier !== 'free' };
}

export function canAccessExplorer(athlete) {
  const tier = athlete?.subscription_tier || 'free';
  return { allowed: tier !== 'free' };
}

export function hasCoachFeatures(athlete) {
  const tier = athlete?.subscription_tier || 'free';
  return { allowed: tier === 'coach' };
}

// ─── Client-side helpers (use the usage object from /api/me) ─────────────────
// These consume the `usage` object returned by GET /api/me.

/**
 * Returns a string description of the remaining free allowance, or null if paid.
 * @param {{ interventionsUsed: number, interventionsLimit: number|null }} usage
 */
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
