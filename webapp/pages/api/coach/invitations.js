import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';

export const runtime = 'edge';

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
    .select('id, athlete_id, display_name, coach_code')
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
    .select('id, athlete_id, display_name, coach_code')
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

    // ── GET: list all invitations for this coach ────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('coach_invitations')
        .select('id, email, token, status, expires_at, accepted_at, created_at')
        .eq('coach_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ invitations: data || [], profile });
      return;
    }

    // ── POST: create a new invitation ───────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.email) { res.status(400).json({ error: 'email is required' }); return; }

      const expiresInHours = typeof body.expires_in_hours === 'number' ? body.expires_in_hours : 72;
      const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
      const token = crypto.randomUUID();

      const { data, error } = await supabase
        .from('coach_invitations')
        .insert({
          coach_id: profile.id,
          email: body.email.trim().toLowerCase(),
          token,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select('id, email, token, status, expires_at, created_at')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ invitation: data, profile });
      return;
    }

    // ── PATCH: revoke an invitation ─────────────────────────────────────────
    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (!body.id) { res.status(400).json({ error: 'id is required' }); return; }

      const updates = {};
      if (body.status !== undefined) updates.status = body.status;

      const { data, error } = await supabase
        .from('coach_invitations')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ invitation: data });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
