import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';

export const runtime = 'edge';

const VALID_NOTE_TYPES = ['observation', 'flag', 'reminder', 'race_debrief'];
const VALID_EVIDENCE_TYPES = ['sleep_dip', 'hrv_trend', 'compliance_miss'];
const QUICK_COACH_PROMPT_TEMPLATES = [
  'How did legs feel after heat block day 4?',
  "Any unusual soreness after today's intensity?",
  'Did fueling match the protocol targets?',
  'How was sleep quality before this workout?',
];


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

      const protocolAssignmentId = typeof req.query.protocol_assignment_id === 'string' ? req.query.protocol_assignment_id : null;
      const workoutId = typeof req.query.workout_id === 'string' ? req.query.workout_id : null;
      const workoutDate = typeof req.query.workout_date === 'string' ? req.query.workout_date : null;

      let query = supabase
        .from('coach_notes')
        .select('id, athlete_id, content, note_type, related_intervention_id, related_protocol_id, protocol_assignment_id, workout_id, workout_date, is_pinned, created_at, parent_note_id, thread_key, evidence_cards')
        .eq('coach_id', profile.id)
        .eq('athlete_id', filterAthleteId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: true });

      if (protocolAssignmentId) query = query.eq('protocol_assignment_id', protocolAssignmentId);
      if (workoutId) query = query.eq('workout_id', workoutId);
      if (workoutDate) query = query.eq('workout_date', workoutDate);

      const { data, error } = await query;

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ notes: data || [], quickPromptTemplates: QUICK_COACH_PROMPT_TEMPLATES });
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

      const protocolAssignmentId = body.protocol_assignment_id || null;
      const workoutId = body.workout_id || null;
      const workoutDate = body.workout_date || null;
      const evidenceCards = normalizeEvidenceCards(body.evidence_cards);

      const { data, error } = await supabase
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
        })
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
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

      if (updates.protocol_assignment_id !== undefined || updates.workout_id !== undefined || updates.workout_date !== undefined) {
        const { data: existing } = await supabase.from('coach_notes').select('athlete_id, protocol_assignment_id, workout_id, workout_date').eq('id', body.id).eq('coach_id', profile.id).maybeSingle();
        if (existing) {
          const protocolAssignmentId = updates.protocol_assignment_id ?? existing.protocol_assignment_id;
          const workoutId = updates.workout_id ?? existing.workout_id;
          const workoutDate = updates.workout_date ?? existing.workout_date;
          updates.thread_key = buildThreadKey({ athleteId: existing.athlete_id, protocolAssignmentId, workoutId, workoutDate });
        }
      }

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
