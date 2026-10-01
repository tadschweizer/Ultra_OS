import { coachEntitlement, hasPaidAccess, isActiveCoachingRelationship } from './pilotEntitlements.js';
import { COACH_TIERS } from './subscriptionTiers.js';

export class EntitlementLookupError extends Error {
  constructor() { super('Access could not be verified. Please try again.'); this.name = 'EntitlementLookupError'; }
}
function checked(result) {
  if (result.error) throw new EntitlementLookupError();
  return result.data;
}

export async function loadCoachEntitlement(admin, profile, athlete = null, now = new Date()) {
  if (!profile?.id) return coachEntitlement({});
  const owner = athlete || checked(await admin.from('athletes')
    .select('id, subscription_tier, stripe_subscription_id, stripe_subscription_status')
    .eq('id', profile.athlete_id).maybeSingle());
  if (!owner || owner.id !== profile.athlete_id) throw new EntitlementLookupError();
  // Independent paid access survives pilot-table failures.
  if (hasPaidAccess(owner, COACH_TIERS)) return coachEntitlement({ athlete: owner, profile, now });
  const grant = checked(await admin.from('coach_pilot_entitlements')
    .select('coach_id, starts_at, expires_at, revoked_at').eq('coach_id', profile.id).maybeSingle());
  return coachEntitlement({ athlete: owner, profile, grant, now });
}

/**
 * Check-in access plus whether the athlete is coached on a paid coach plan.
 * A paid-coach link also grants Athlete Core (`linkedToPaidCoach`); a pilot
 * link uncaps check-ins only, per the closed-pilot runbook.
 */
export async function loadCheckInEntitlement(admin, athlete, now = new Date()) {
  if (!athlete?.id) throw new EntitlementLookupError();
  // Every paid tier already includes Core, so paid access needs no coach lookup
  // and survives pilot-table failures.
  if (hasPaidAccess(athlete)) return { unlimited: true, source: 'independent_paid', linkedToPaidCoach: false };
  const relationships = checked(await admin.from('coach_athlete_relationships')
    .select('coach_id, status, removed_at, expires_at').eq('athlete_id', athlete.id).eq('status', 'active'));
  let pilotSource = null;
  for (const relationship of relationships || []) {
    if (!isActiveCoachingRelationship(relationship, now)) continue;
    const profile = checked(await admin.from('coach_profiles').select('id, athlete_id')
      .eq('id', relationship.coach_id).maybeSingle());
    if (!profile) throw new EntitlementLookupError();
    const entitlement = await loadCoachEntitlement(admin, profile, null, now);
    if (entitlement.paid) return { unlimited: true, source: entitlement.source, linkedToPaidCoach: true };
    if (entitlement.eligible) pilotSource = entitlement.source;
  }
  if (pilotSource) return { unlimited: true, source: pilotSource, linkedToPaidCoach: false };
  return { unlimited: false, source: 'own_plan', linkedToPaidCoach: false };
}
