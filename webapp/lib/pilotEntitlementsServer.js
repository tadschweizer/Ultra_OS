import { coachEntitlement, hasPaidAccess, isActiveCoachingRelationship } from './pilotEntitlements.js';

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
  if (hasPaidAccess(owner, ['coach'])) return coachEntitlement({ athlete: owner, profile, now });
  const grant = checked(await admin.from('coach_pilot_entitlements')
    .select('coach_id, starts_at, expires_at, revoked_at').eq('coach_id', profile.id).maybeSingle());
  return coachEntitlement({ athlete: owner, profile, grant, now });
}

export async function loadCheckInEntitlement(admin, athlete, now = new Date()) {
  if (!athlete?.id) throw new EntitlementLookupError();
  if (hasPaidAccess(athlete)) return { unlimited: true, source: 'independent_paid' };
  const relationships = checked(await admin.from('coach_athlete_relationships')
    .select('coach_id, status, removed_at, expires_at').eq('athlete_id', athlete.id).eq('status', 'active'));
  for (const relationship of relationships || []) {
    if (!isActiveCoachingRelationship(relationship, now)) continue;
    const profile = checked(await admin.from('coach_profiles').select('id, athlete_id')
      .eq('id', relationship.coach_id).maybeSingle());
    if (!profile) throw new EntitlementLookupError();
    const entitlement = await loadCoachEntitlement(admin, profile, null, now);
    if (entitlement.eligible) return { unlimited: true, source: entitlement.source };
  }
  return { unlimited: false, source: 'own_plan' };
}
