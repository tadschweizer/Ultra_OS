import { getSupabaseAdminClient } from '../../../lib/authServer';
import { requireCoachAccess } from '../../../lib/auth/roleAccessServer.js';

// Coach tables are no longer reachable with the public anon key (RLS is on and
// the anon grants are revoked), so this route uses the service-role client.
// Authorisation is enforced in the handler from the session athlete id.
const supabase = getSupabaseAdminClient();

export default async function handler(req, res) {
  const access = await requireCoachAccess(req, res, supabase);
  if (!access) return;

  try {
    const profile = access.profile;

    // ── GET: full rich profile ───────────────────────────────────────────────
    if (req.method === 'GET') {
      res.status(200).json({ profile });
      return;
    }

    // ── PATCH: update editable profile fields ────────────────────────────────
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const updates = {};
      const editable = ['display_name', 'bio', 'specialties', 'certifications', 'avatar_url', 'max_athletes'];
      for (const key of editable) {
        if (body[key] !== undefined) updates[key] = body[key];
      }

      if (!Object.keys(updates).length) {
        res.status(400).json({ error: 'No updatable fields provided' });
        return;
      }

      const { data, error } = await supabase
        .from('coach_profiles')
        .update(updates)
        .eq('id', profile.id)
        .select('id, athlete_id, display_name, coach_code, bio, specialties, certifications, avatar_url, max_athletes, subscription_status, subscription_tier, updated_at')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ profile: data });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
