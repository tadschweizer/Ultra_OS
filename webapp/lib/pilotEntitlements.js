import { normalizeSubscriptionTier } from './subscriptionTiers.js';
import { isEntitledSubscriptionStatus } from './billingPlans.js';

export function hasActivePilot(grant, now = new Date()) {
  return Boolean(grant && !grant.revoked_at
    && Date.parse(grant.starts_at) <= now.getTime()
    && Date.parse(grant.expires_at) > now.getTime());
}

// Preserve the existing administrator-provisioned paid-tier pattern. Stripe-owned
// accounts additionally require the canonical active/trialing/past_due status.
export function hasPaidAccess(athlete, tiers = ['individual', 'coach']) {
  return tiers.includes(normalizeSubscriptionTier(athlete?.subscription_tier))
    && (!athlete?.stripe_subscription_id || isEntitledSubscriptionStatus(athlete.stripe_subscription_status));
}

export function isActiveCoachingRelationship(relationship, now = new Date()) {
  return relationship?.status === 'active' && !relationship.removed_at
    && (!relationship.expires_at || Date.parse(relationship.expires_at) > now.getTime());
}

export function coachEntitlement({ athlete, profile, grant, now = new Date() }) {
  const pilot = Boolean(profile?.id) && hasActivePilot(grant, now);
  const paid = Boolean(profile?.id) && hasPaidAccess(athlete, ['coach']);
  return { eligible: pilot || paid, pilot, paid, source: paid ? 'paid_coach' : pilot ? 'pilot_coach' : null };
}
