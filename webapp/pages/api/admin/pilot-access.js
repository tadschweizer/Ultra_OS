import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { requireAdminAthleteId, requireLiveAthleteId } from '../../../lib/auth/requireAthlete.js';
import { isValidAthleteId } from '../../../lib/auth/contracts.js';

export function createPilotAccessHandler({ getClient = getSupabaseAdminClient, now = () => new Date() } = {}) {
  return async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).end();
    // Require a same-origin JSON mutation; never accept a cross-site form or GET write.
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      const expected = process.env.NEXT_PUBLIC_SITE_URL;
      let sameOrigin = false;
      try { sameOrigin = Boolean(origin && expected && new URL(origin).origin === new URL(expected).origin); } catch {}
      if (!sameOrigin || !req.headers['content-type']?.startsWith('application/json')) {
        return res.status(403).json({ error: 'Use the administrator page on this site.' });
      }
    }
    try {
      const admin = getClient();
      if (!(await requireLiveAthleteId(req, res, admin))) return;
      const adminId = await requireAdminAthleteId(req, res, admin);
      if (!adminId) return;
      const coachId = req.method === 'GET' ? req.query.coach_id : req.body?.coach_id;
      if (!isValidAthleteId(coachId)) return res.status(400).json({ error: 'A valid coach profile ID is required.' });
      const { data: profile, error: profileError } = await admin.from('coach_profiles')
        .select('id, athlete_id, display_name').eq('id', coachId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return res.status(404).json({ error: 'Coach profile not found. Complete coach onboarding first.' });
      if (req.method === 'GET') {
        const { data, error } = await admin.from('coach_pilot_entitlements').select('*').eq('coach_id', coachId).maybeSingle();
        if (error) throw error;
        return res.status(200).json({ profile, grant: data });
      }
      const { action, expires_at: expiresAt, reason } = req.body || {};
      if (!['grant', 'revoke'].includes(action) || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) {
        return res.status(400).json({ error: 'Choose grant or revoke and provide a reason (1–500 characters).' });
      }
      const timestamp = now().toISOString();
      if (action === 'grant' && !(Date.parse(expiresAt) > Date.parse(timestamp))) {
        return res.status(400).json({ error: 'Choose a future pilot expiration date.' });
      }
      const changes = { updated_by: adminId, updated_at: timestamp, reason: reason.trim() };
      const query = action === 'grant'
        ? admin.from('coach_pilot_entitlements').upsert({ ...changes, coach_id: coachId, starts_at: timestamp,
          expires_at: new Date(expiresAt).toISOString(), revoked_at: null }, { onConflict: 'coach_id' })
        : admin.from('coach_pilot_entitlements').update({ ...changes, revoked_at: timestamp }).eq('coach_id', coachId);
      const { data, error } = await query.select('*').maybeSingle();
      if (error) throw error;
      return res.status(200).json({ profile, grant: data, action });
    } catch {
      return res.status(503).json({ error: 'Pilot access could not be saved or loaded. Please try again.' });
    }
  };
}
export default createPilotAccessHandler();
