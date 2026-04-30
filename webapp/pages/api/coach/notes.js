import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';

export const runtime = 'edge';

const VALID_NOTE_TYPES = ['observation', 'flag', 'reminder', 'race_debrief', 'daily', 'weekly', 'timeline'];

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

function normalizeEvidenceCards(rawCards) {
  if (!Array.isArray(rawCards)) return [];
  return rawCards
    .map((card) => ({
      type: card?.type,
      title: card?.title?.trim() || null,
      value: card?.value?.trim() || null,
      source_ref: card?.source_ref?.trim() || null,
    }))
    .filter((card) => VALID_EVIDENCE_TYPES.includes(card.type));
}

function buildThreadKey({ athleteId, protocolAssignmentId, workoutId, workoutDate }) {
  const datePart = workoutDate || 'none';
  return `${athleteId}::${protocolAssignmentId || 'none'}::${workoutId || 'none'}::${datePart}`;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

    if (req.method === 'GET') {
      const filterAthleteId = typeof req.query.athlete_id === 'string' ? req.query.athlete_id : null;
      if (!filterAthleteId) {
        res.status(400).json({ error: 'athlete_id query param is required' });
        return;
      }

      let query = supabase
        .from('coach_notes')
        .select('id, athlete_id, content, note_type, related_intervention_id, related_protocol_id, is_pinned, created_at, share_with_athlete, athlete_read_at, tags')
        .eq('coach_id', profile.id)
        .eq('athlete_id', filterAthleteId);

      if (typeof req.query.pinned === 'string') query = query.eq('is_pinned', req.query.pinned === 'true');
      if (typeof req.query.note_type === 'string' && VALID_NOTE_TYPES.includes(req.query.note_type)) query = query.eq('note_type', req.query.note_type);
      if (typeof req.query.from === 'string') query = query.gte('created_at', req.query.from);
      if (typeof req.query.to === 'string') query = query.lte('created_at', req.query.to);
      if (typeof req.query.share_with_athlete === 'string') query = query.eq('share_with_athlete', req.query.share_with_athlete === 'true');

      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      if (search) query = query.or(`content.ilike.%${search}%,tags.cs.{${search}}`);

      const { data, error: queryError } = await query
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: true });

      if (protocolAssignmentId) query = query.eq('protocol_assignment_id', protocolAssignmentId);
      if (workoutId) query = query.eq('workout_id', workoutId);
      if (workoutDate) query = query.eq('workout_date', workoutDate);

      const { data, error } = await query;

      if (queryError) { res.status(500).json({ error: queryError.message }); return; }
      res.status(200).json({ notes: data || [] });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.athlete_id) { res.status(400).json({ error: 'athlete_id is required' }); return; }
      if (!body.content?.trim()) { res.status(400).json({ error: 'content is required' }); return; }
      if (!VALID_NOTE_TYPES.includes(body.note_type)) {
        res.status(400).json({ error: `note_type must be one of: ${VALID_NOTE_TYPES.join(', ')}` });
        return;
      }

      const { data, error: insertError } = await supabase
        .from('coach_notes')
        .insert({
          coach_id: profile.id,
          athlete_id: body.athlete_id,
          content: body.content.trim(),
          note_type: body.note_type,
          related_intervention_id: body.related_intervention_id || null,
          related_protocol_id: body.related_protocol_id || null,
          protocol_assignment_id: protocolAssignmentId,
          workout_id: workoutId,
          workout_date: workoutDate,
          parent_note_id: body.parent_note_id || null,
          thread_key: buildThreadKey({ athleteId: body.athlete_id, protocolAssignmentId, workoutId, workoutDate }),
          evidence_cards: evidenceCards,
          is_pinned: body.is_pinned === true,
          share_with_athlete: body.share_with_athlete === true,
          athlete_read_at: body.athlete_read_at || null,
          tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : null,
        })
        .select('*')
        .single();

      if (insertError) { res.status(500).json({ error: insertError.message }); return; }
      res.status(200).json({ note: data });
      return;
    }

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
      if (body.protocol_assignment_id !== undefined) updates.protocol_assignment_id = body.protocol_assignment_id || null;
      if (body.workout_id !== undefined) updates.workout_id = body.workout_id || null;
      if (body.workout_date !== undefined) updates.workout_date = body.workout_date || null;
      if (body.parent_note_id !== undefined) updates.parent_note_id = body.parent_note_id || null;
      if (body.evidence_cards !== undefined) updates.evidence_cards = normalizeEvidenceCards(body.evidence_cards);
      if (body.is_pinned !== undefined) updates.is_pinned = Boolean(body.is_pinned);
      if (body.share_with_athlete !== undefined) updates.share_with_athlete = Boolean(body.share_with_athlete);
      if (body.athlete_read_at !== undefined) updates.athlete_read_at = body.athlete_read_at;
      if (body.mark_read === true) updates.athlete_read_at = new Date().toISOString();
      if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : null;

      const { data, error: updateError } = await supabase
        .from('coach_notes')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (updateError) { res.status(500).json({ error: updateError.message }); return; }
      res.status(200).json({ note: data });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) { res.status(400).json({ error: 'id is required' }); return; }

      const { error: deleteError } = await supabase
        .from('coach_notes')
        .delete()
        .eq('id', id)
        .eq('coach_id', profile.id);

      if (deleteError) { res.status(500).json({ error: deleteError.message }); return; }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (caughtError) {
    res.status(500).json({ error: caughtError.message });
  }
}
