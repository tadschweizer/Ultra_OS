import { buildAccountAccess } from './roleGuards.js';
import { resolveEffectiveAthleteId } from './requireAthlete.js';

const ACCOUNT_FIELDS = 'id, name, primary_role, subscription_tier, is_admin, onboarding_complete';
const COACH_PROFILE_FIELDS = [
  'id',
  'athlete_id',
  'display_name',
  'coach_code',
  'bio',
  'specialties',
  'certifications',
  'avatar_url',
  'max_athletes',
  'subscription_status',
  'subscription_tier',
  'created_at',
  'updated_at',
].join(', ');

export async function loadAccountAccess(admin, athleteOrId) {
  let athlete = typeof athleteOrId === 'string' ? null : athleteOrId;
  const athleteId = typeof athleteOrId === 'string' ? athleteOrId : athleteOrId?.id;
  if (!athleteId) return null;

  if (!athlete?.primary_role || athlete.is_admin === undefined || !athlete.subscription_tier) {
    const { data, error } = await admin
      .from('athletes')
      .select(ACCOUNT_FIELDS)
      .eq('id', athleteId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    athlete = { ...athlete, ...data };
  }

  const { data: coachProfile, error: coachError } = await admin
    .from('coach_profiles')
    .select(COACH_PROFILE_FIELDS)
    .eq('athlete_id', athleteId)
    .maybeSingle();
  if (coachError) throw coachError;

  return {
    athlete,
    ...buildAccountAccess({ athlete, coachProfile }),
  };
}

export async function requireCoachAccess(req, res, admin) {
  const resolved = await resolveEffectiveAthleteId(req, admin);
  if (!resolved.athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }

  const access = await loadAccountAccess(admin, resolved.athleteId);
  if (!access?.capabilities.coach) {
    res.status(403).json({ error: 'Coach access required.' });
    return null;
  }

  return { ...access, ...resolved, profile: access.coachProfile };
}

export async function loadActiveCoachRelationship(admin, coachId, athleteId) {
  if (!coachId || !athleteId) return null;
  const { data, error } = await admin
    .from('coach_athlete_relationships')
    .select('id, athlete_id, coach_id, status, group_name')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function requireActiveCoachRelationship(res, admin, coachId, athleteId) {
  const relationship = await loadActiveCoachRelationship(admin, coachId, athleteId);
  if (!relationship) {
    res.status(403).json({ error: 'No active coaching relationship with this athlete.' });
    return null;
  }
  return relationship;
}

export { COACH_PROFILE_FIELDS };
