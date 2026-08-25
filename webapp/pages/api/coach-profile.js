import { getSupabaseAdminClient } from '../../lib/authServer';
import { generateCoachCode } from '../../lib/coachProtocols';
import { resolveEffectiveAthleteId } from '../../lib/auth/requireAthlete.js';
import { COACH_PROFILE_FIELDS, loadAccountAccess } from '../../lib/auth/roleAccessServer.js';
import { canCreateCoachProfile } from '../../lib/auth/roleGuards.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.status(405).end();
    return;
  }

  const admin = getSupabaseAdminClient();
  const { athleteId } = await resolveEffectiveAthleteId(req, admin);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const access = await loadAccountAccess(admin, athleteId);

    if (req.method === 'GET') {
      if (!access?.coachProfile) {
        res.status(404).json({ error: 'Coach profile not found.' });
        return;
      }
      res.status(200).json({ profile: access.coachProfile });
      return;
    }

    if (access.coachProfile) {
      res.status(200).json({ profile: access.coachProfile, created: false });
      return;
    }

    // This is the only self-service coach-profile creation path. Request-body
    // role or tier values are ignored. The server authorizes either persisted
    // coach intent during onboarding or an already-recorded coach subscription,
    // which gives completed paid accounts an explicit recovery path.
    if (!canCreateCoachProfile(access)) {
      res.status(403).json({
        error: 'Coach profiles require coach onboarding or an active coach subscription.',
      });
      return;
    }

    const { data: profile, error } = await admin
      .from('coach_profiles')
      .insert({
        athlete_id: athleteId,
        display_name: access.athlete?.name || 'Coach',
        coach_code: generateCoachCode(access.athlete?.name || 'Coach'),
      })
      .select(COACH_PROFILE_FIELDS)
      .single();
    if (error) throw error;

    res.status(201).json({ profile, created: true });
  } catch (error) {
    console.error('[coach-profile] failed:', error);
    res.status(500).json({ error: error.message });
  }
}
