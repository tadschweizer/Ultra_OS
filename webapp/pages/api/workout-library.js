import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';
import { estimateTss, summarizeStructure } from '../../lib/workoutCompliance';

const LIBRARY_COLUMNS = `
  id, coach_id, name, sport, description, structure,
  planned_duration_min, planned_distance_km, planned_tss, tags, created_at, updated_at
`;

async function getCoachProfile(admin, athleteId) {
  const { data: profile } = await admin
    .from('coach_profiles')
    .select('id')
    .eq('athlete_id', athleteId)
    .maybeSingle();
  return profile || null;
}

function normalizePayload(body) {
  const payload = {};
  ['name', 'sport', 'description'].forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });
  if (body.structure !== undefined) {
    payload.structure = Array.isArray(body.structure) ? body.structure : [];
  }
  ['planned_duration_min', 'planned_distance_km', 'planned_tss'].forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = body[field] === null || body[field] === '' ? null : Number(body[field]);
    }
  });
  if (body.tags !== undefined) {
    payload.tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean)
      : null;
  }
  if (payload.structure?.length) {
    const totals = summarizeStructure(payload.structure);
    if (payload.planned_duration_min == null && totals.durationMin > 0) {
      payload.planned_duration_min = totals.durationMin;
    }
    if (payload.planned_distance_km == null && totals.distanceKm > 0) {
      payload.planned_distance_km = totals.distanceKm;
    }
    if (payload.planned_tss == null) {
      payload.planned_tss = estimateTss(payload.structure, payload.planned_duration_min);
    }
  }
  return payload;
}

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    const profile = await getCoachProfile(admin, athleteId);
    if (!profile) {
      res.status(403).json({ error: 'Workout library is available to coach accounts.' });
      return;
    }

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('workout_library')
        .select(LIBRARY_COLUMNS)
        .eq('coach_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ workouts: data || [] });
      return;
    }

    if (req.method === 'POST') {
      const payload = normalizePayload(req.body || {});
      if (!payload.name) {
        res.status(400).json({ error: 'name is required.' });
        return;
      }
      const { data, error } = await admin
        .from('workout_library')
        .insert({ ...payload, coach_id: profile.id })
        .select(LIBRARY_COLUMNS)
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ workout: data });
      return;
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (!body.id) {
        res.status(400).json({ error: 'id is required.' });
        return;
      }
      const payload = normalizePayload(body);
      payload.updated_at = new Date().toISOString();
      const { data, error } = await admin
        .from('workout_library')
        .update(payload)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select(LIBRARY_COLUMNS)
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ workout: data });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) {
        res.status(400).json({ error: 'id is required.' });
        return;
      }
      const { error } = await admin
        .from('workout_library')
        .delete()
        .eq('id', id)
        .eq('coach_id', profile.id);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[workout-library] failed:', error);
    res.status(500).json({ error: error.message });
  }
}
