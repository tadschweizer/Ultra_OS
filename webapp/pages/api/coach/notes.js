import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../../lib/authServer';
import { generateCoachCode } from '../../../lib/coachProtocols';

const VALID_NOTE_TYPES = ['observation', 'flag', 'reminder', 'race_debrief'];

async function ensureCoachProfile(athleteId) {
  const supabase = getSupabaseAdminClient();
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
  const athleteId = getAthleteIdFromRequest(req);
  const supabase = getSupabaseAdminClient();
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

    // ── GET: list notes, filtered by athlete_id ─────────────────────────────
    if (req.method === 'GET') {
      const filterAthleteId = typeof req.query.athlete_id === 'string' ? req.query.athlete_id : null;
      if (!filterAthleteId) {
        res.status(400).json({ error: 'athlete_id query param is required' });
        return;
      }

      const { data, error } = await supabase
        .from('coach_notes')
        .select('id, athlete_id, content, note_type, related_intervention_id, related_protocol_id, is_pinned, created_at')
        .eq('coach_id', profile.id)
        .eq('athlete_id', filterAthleteId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ notes: data || [] });
      return;
    }

    // ── POST: create a note ─────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.athlete_id) { res.status(400).json({ error: 'athlete_id is required' }); return; }
      if (!body.content?.trim()) { res.status(400).json({ error: 'content is required' }); return; }
      if (!VALID_NOTE_TYPES.includes(body.note_type)) {
        res.status(400).json({ error: `note_type must be one of: ${VALID_NOTE_TYPES.join(', ')}` });
        return;
      }

      const { data, error } = await supabase
        .from('coach_notes')
        .insert({
          coach_id: profile.id,
          athlete_id: body.athlete_id,
          content: body.content.trim(),
          note_type: body.note_type,
          related_intervention_id: body.related_intervention_id || null,
          related_protocol_id: body.related_protocol_id || null,
          is_pinned: body.is_pinned === true,
        })
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ note: data });
      return;
    }

    // ── PATCH: update content, type, pin status ─────────────────────────────
    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (!body.id) { res.status(400).json({ error: 'id is required' }); return; }

      const updates = {};
      if (body.content !== undefined) updates.content = body.content.trim();
      if (body.note_type !== undefined) {
        if (!VALID_NOTE_TYPES.includes(body.note_type)) {
          res.status(400).json({ error: `note_type must be one of: ${VALID_NOTE_TYPES.join(', ')}` });
          return;
        }
        updates.note_type = body.note_type;
      }
      if (body.is_pinned !== undefined) updates.is_pinned = Boolean(body.is_pinned);

      const { data, error } = await supabase
        .from('coach_notes')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ note: data });
      return;
    }

    // ── DELETE: remove a note ───────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) { res.status(400).json({ error: 'id is required' }); return; }

      const { error } = await supabase
        .from('coach_notes')
        .delete()
        .eq('id', id)
        .eq('coach_id', profile.id);

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
