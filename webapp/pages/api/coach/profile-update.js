import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();

  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code, bio, specialties, certifications, avatar_url, max_athletes, subscription_status, subscription_tier, created_at, updated_at')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('coach_profiles')
    .insert({
      athlete_id: athleteId,
      display_name: athlete?.name || 'Coach',
      coach_code: generateCoachCode(athlete?.name || 'Coach'),
    })
    .select('id, athlete_id, display_name, coach_code, bio, specialties, certifications, avatar_url, max_athletes, subscription_status, subscription_tier, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

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
