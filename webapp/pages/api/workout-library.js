import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { requireCoachAccess } from '../../lib/auth/roleAccessServer.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';
import { normalizeLibraryPayload } from '../../lib/libraryValidation.js';
export { normalizeLibraryPayload } from '../../lib/libraryValidation.js';

export const LIBRARY_COLUMNS = `id, coach_id, name, sport, description, structure,
  objective, coach_instructions, planned_if, target_metric, visibility,
  planned_duration_min, planned_distance_km, planned_distance_unit, planned_tss,
  tags, created_at, updated_at`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }

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
        const requestId = req.body.client_request_id;
        if (typeof requestId !== 'string' || !UUID.test(requestId)) invalid('A valid library create operation id is required.');
        const { data: receipt, error: createError } = await admin.rpc('create_workout_library_once', {
          p_coach_id: coachId, p_request_id: requestId, p_payload: payload,
        });
        if (createError) throw createError;
        if (receipt?.status === 'conflict') return res.status(409).json({ error: 'This save already belongs to a different prescription. Retry the original save; start a new save for another template.' });
        if (receipt?.status === 'deleted') return res.status(410).json({ error: 'The template from this save was deleted. It was not recreated. Use a new save for an intentional new template.' });
        if (receipt?.status !== 'saved' || !UUID.test(receipt.id)) throw new Error('Invalid library create receipt.');
        const { data, error } = await admin.from('workout_library').select(LIBRARY_COLUMNS)
          .eq('id', receipt.id).eq('coach_id', coachId).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(410).json({ error: 'The saved template was deleted. It was not recreated.' });
        return res.status(200).json({ workout: data, replayed: receipt.replayed === true });
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
