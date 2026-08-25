import { normalizeSubscriptionTier } from '../subscriptionTiers.js';

export const PRIMARY_ROLES = Object.freeze(['athlete', 'coach']);
export const SIGNUP_ROLE_VALUES = Object.freeze(['coach', 'athlete-with-coach', 'individual']);

export function isValidPrimaryRole(value) {
  return PRIMARY_ROLES.includes(value);
}

export function normalizePrimaryRole(value) {
  return value === 'coach' ? 'coach' : 'athlete';
}

export function isValidSignupRole(value) {
  return SIGNUP_ROLE_VALUES.includes(value);
}

export function primaryRoleForSignupRole(value) {
  return value === 'coach' ? 'coach' : 'athlete';
}

/**
 * Canonical account access model. primaryRole controls the default experience
 * only; every authority signal remains independently server-derived.
 */
export function buildAccountAccess({ athlete, coachProfile = null } = {}) {
  const primaryRole = normalizePrimaryRole(athlete?.primary_role);
  const hasCoachProfile = Boolean(coachProfile?.id);
  const hasPaidCoachEntitlement =
    hasCoachProfile && normalizeSubscriptionTier(athlete?.subscription_tier) === 'coach';

  return {
    primaryRole,
    capabilities: {
      athlete: Boolean(athlete?.id),
      coach: hasCoachProfile,
      paidCoach: hasPaidCoachEntitlement,
      administrator: Boolean(athlete?.is_admin),
    },
    defaultPath: primaryRole === 'coach' && hasCoachProfile
      ? '/coach-command-center'
      : '/dashboard',
    coachProfile: coachProfile || null,
  };
}

export function hasRole(access, role) {
  if (!access) return false;
  const capabilities = access.capabilities || buildAccountAccess({ athlete: access }).capabilities;
  if (role === 'admin') return capabilities.administrator;
  if (role === 'coach') return capabilities.coach;
  if (role === 'athlete') return capabilities.athlete;
  return false;
}

export function requireRole(access, role) {
  return hasRole(access, role)
    ? { allowed: true }
    : { allowed: false, error: `Requires ${role} access.` };
}
