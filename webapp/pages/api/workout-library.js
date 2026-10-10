import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { estimateTss, summarizeStructure } from '../../lib/workoutCompliance.js';
import { requireCoachAccess } from '../../lib/auth/roleAccessServer.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';
import { validateWorkoutFields } from '../../lib/workoutValidation.js';

export const LIBRARY_COLUMNS = `id, coach_id, name, sport, description, structure,
  objective, coach_instructions, planned_if, target_metric, visibility,
  planned_duration_min, planned_distance_km, planned_distance_unit, planned_tss,
  tags, created_at, updated_at`;
const TARGETS = new Set(['duration', 'distance', 'tss', 'pace', 'heart_rate', 'power', 'rpe']);
const VISIBILITY = new Set(['athlete_visible', 'coach_private']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
export function normalizeLibraryPayload(body, { create = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Enter a valid library workout.');
  const payload = {};
  for (const field of ['name', 'sport', 'description', 'objective', 'coach_instructions']) {
    if (body[field] === undefined) continue;
    const nullable = !['name', 'sport'].includes(field);
    if (!(nullable && body[field] === null) && (typeof body[field] !== 'string'
      || body[field].length > (field === 'name' ? 200 : field === 'sport' ? 50 : 10000))) invalid(`Invalid ${field}.`);
    if (!nullable && !body[field].trim()) invalid(`${field} is required.`);
    payload[field] = ['name', 'sport'].includes(field) ? body[field].trim() : body[field];
  }
  if (create && !payload.name) invalid('name is required.');
  if (body.planned_distance_unit !== undefined) {
    if (!['mi', 'km'].includes(body.planned_distance_unit)) invalid('Choose miles or kilometers.');
    payload.planned_distance_unit = body.planned_distance_unit;
  }
  for (const field of ['planned_duration_min', 'planned_distance_km', 'planned_tss', 'planned_if']) {
    if (body[field] !== undefined) payload[field] = body[field] === '' ? null : body[field];
  }
  const validation = validateWorkoutFields(payload);
  if (validation) invalid(validation);
  if (body.structure !== undefined) {
    if (!Array.isArray(body.structure) || body.structure.length > 100
      || body.structure.some(step => !step || typeof step !== 'object' || Array.isArray(step))) invalid('Enter a valid workout structure.');
    payload.structure = body.structure;
  }
  if (body.target_metric !== undefined) {
    if (!TARGETS.has(body.target_metric)) invalid('Choose a valid primary target.');
    payload.target_metric = body.target_metric;
  }
  if (body.visibility !== undefined) {
    if (!VISIBILITY.has(body.visibility)) invalid('Choose a valid workout visibility.');
    payload.visibility = body.visibility;
  }
  if (body.tags !== undefined) {
    if (body.tags !== null && (!Array.isArray(body.tags) || body.tags.length > 50
      || body.tags.some(tag => typeof tag !== 'string' || tag.length > 100))) invalid('Enter valid tags.');
    payload.tags = body.tags?.map(tag => tag.trim()).filter(Boolean) ?? null;
  }
  // Derive an omitted new value, never replace explicit null/zero or PATCH omission.
  if (create && payload.structure?.length) {
    const totals = summarizeStructure(payload.structure);
    if (!Object.hasOwn(payload, 'planned_duration_min') && totals.durationMin > 0) payload.planned_duration_min = totals.durationMin;
    if (!Object.hasOwn(payload, 'planned_distance_km') && totals.distanceKm > 0) payload.planned_distance_km = totals.distanceKm;
    if (!Object.hasOwn(payload, 'planned_tss')) payload.planned_tss = estimateTss(payload.structure, payload.planned_duration_min);
    const derivedValidation = validateWorkoutFields(payload);
    if (derivedValidation) invalid(derivedValidation);
  }
  return payload;
}

export function createWorkoutLibraryHandler({ getClient = getSupabaseAdminClient } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    try {
      if (req.method !== 'GET' && !requireSameOriginJson(req, res, req.method)) return;
      const admin = getClient();
      const access = await requireCoachAccess(req, res, admin);
      if (!access) return;
      const coachId = access.profile.id;
      if (req.method === 'GET') {
        const { data, error } = await admin.from('workout_library').select(LIBRARY_COLUMNS)
          .eq('coach_id', coachId).order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ workouts: data || [] });
      }
      if (req.method === 'POST') {
        const payload = normalizeLibraryPayload(req.body, { create: true });
        const { data, error } = await admin.from('workout_library').insert({ ...payload, coach_id: coachId })
          .select(LIBRARY_COLUMNS).single();
        if (error) throw error;
        return res.status(200).json({ workout: data });
      }
      const id = req.method === 'DELETE' ? req.query?.id || req.body?.id : req.body?.id;
      if (typeof id !== 'string' || !UUID.test(id)) invalid('A valid library workout id is required.');
      if (req.method === 'PATCH') {
        const payload = normalizeLibraryPayload(req.body);
        const { data, error } = await admin.from('workout_library')
          .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).eq('coach_id', coachId)
          .select(LIBRARY_COLUMNS).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Library workout not found.' });
        return res.status(200).json({ workout: data });
      }
      const { data, error } = await admin.from('workout_library').delete().eq('id', id).eq('coach_id', coachId)
        .select('id').maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Library workout not found.' });
      return res.status(200).json({ success: true });
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ error: error.message });
      console.error('[workout-library] failed:', error.message);
      return res.status(503).json({ error: 'Workout library is unavailable. Your changes were not confirmed; retry when service is restored.' });
    }
  };
}
export default createWorkoutLibraryHandler();
