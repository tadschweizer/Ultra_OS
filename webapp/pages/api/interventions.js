import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';
import { inferLegacyScores, normalizeProtocolPayload } from '../../lib/interventionCatalog';

export const runtime = 'edge';

function getAthleteId(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return cookies.athlete_id;
}

function parseOptionalInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizePayload(body = {}, athleteId) {
  const protocolPayload = normalizeProtocolPayload(body.intervention_type, body.protocol_payload || {});
  const legacyFields = inferLegacyScores(body.intervention_type, protocolPayload);
  return {
    athlete_id: athleteId,
    race_id: body.race_id || null,
    activity_id: body.activity_id || null,
    date: body.date || null,
    intervention_type: body.intervention_type || null,
    details: body.details || legacyFields.details,
    dose_duration: body.dose_duration || legacyFields.dose_duration,
    timing: body.timing || legacyFields.timing,
    protocol_payload: protocolPayload,
    gi_response: parseOptionalInt(body.gi_response) ?? legacyFields.gi_response,
    physical_response: parseOptionalInt(body.physical_response) ?? legacyFields.physical_response,
    subjective_feel: parseOptionalInt(body.subjective_feel) ?? legacyFields.subjective_feel,
    training_phase: body.training_phase || null,
    target_race: body.target_race || null,
    target_race_date: body.target_race_date || null,
    notes: body.notes || null,
  };
}

const interventionSelect =
  'id, athlete_id, date, inserted_at, intervention_type, details, dose_duration, timing, protocol_payload, gi_response, physical_response, subjective_feel, activity_id, training_phase, target_race, target_race_date, race_id, notes, races(id, name, event_date, race_type, distance_miles, elevation_gain_ft, location, surface, notes)';

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method === 'GET') {
    const interventionId = typeof req.query.id === 'string' ? req.query.id : null;
    let query = supabase
      .from('interventions')
      .select(interventionSelect)
      .eq('athlete_id', athleteId);

    if (interventionId) {
      const { data, error } = await query.eq('id', interventionId).single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ intervention: data });
      return;
    }

    const { data, error } = await query
      .order('date', { ascending: false })
      .order('inserted_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const interventions = data || [];
    const today = new Date().toISOString().slice(0, 10);
    const dailySessionLoad = interventions
      .filter((item) => (item.date || item.inserted_at || '').slice(0, 10) === today)
      .reduce((sum, item) => sum + Number(item.protocol_payload?.session_load || 0), 0);
    const rollingWeeklySessionLoad = interventions
      .filter((item) => {
        const d = new Date(item.date || item.inserted_at);
        if (Number.isNaN(d.getTime())) return false;
        const diffDays = (Date.now() - d.getTime()) / 86400000;
        return diffDays >= 0 && diffDays < 7;
      })
      .reduce((sum, item) => sum + Number(item.protocol_payload?.session_load || 0), 0);

    res.status(200).json({
      interventions,
      sessionLoad: {
        daily: dailySessionLoad,
        rollingWeekly: rollingWeeklySessionLoad,
      },
    });
    return;
  }

  if (req.method === 'PUT') {
    const interventionId = req.body?.id;
    if (!interventionId) {
      res.status(400).json({ error: 'Intervention id is required' });
      return;
    }

    const payload = normalizePayload(req.body, athleteId);
    delete payload.athlete_id;

    const { data, error } = await supabase
      .from('interventions')
      .update(payload)
      .eq('id', interventionId)
      .eq('athlete_id', athleteId)
      .select(interventionSelect)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ intervention: data });
    return;
  }

  if (req.method === 'DELETE') {
    const interventionId = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
    if (!interventionId) {
      res.status(400).json({ error: 'Intervention id is required' });
      return;
    }

    const { error } = await supabase
      .from('interventions')
      .delete()
      .eq('id', interventionId)
      .eq('athlete_id', athleteId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ success: true });
    return;
  }

  res.status(405).end();
}
