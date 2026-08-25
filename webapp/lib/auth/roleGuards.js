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

/**
 * Coach-profile creation is explicit and server-authorized. A persisted coach
 * intent may create the profile while onboarding is incomplete. An existing
 * account may also recover after the server has recorded a coach subscription.
 * Neither path trusts a role or entitlement supplied in the request body.
 */
export function canCreateCoachProfile(access) {
  if (!access?.athlete || access.coachProfile) return false;
  const onboardingCoach = access.primaryRole === 'coach'
    && !access.athlete.onboarding_complete;
  const entitledCoach = normalizeSubscriptionTier(access.athlete.subscription_tier) === 'coach';
  return onboardingCoach || entitledCoach;
}

/**
 * Resolves an interaction mode without turning that mode into authority.
 * Forged coach mode is ignored unless the account already has coach capability.
 */
export function resolveAccountMode(access, requestedMode = null) {
  if (requestedMode === 'athlete') return 'athlete';
  if (requestedMode === 'coach' && access?.capabilities?.coach) return 'coach';
  return access?.primaryRole === 'coach' && access?.capabilities?.coach
    ? 'coach'
    : 'athlete';
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
