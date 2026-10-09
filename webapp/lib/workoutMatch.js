import { validWorkoutRequestId } from './workoutValidation.js';

export function validateMatchDecision(body) {
  if (!['confirm', 'reject', 'auto'].includes(body.match_action)) return 'Choose a valid match decision.';
  if (body.match_action === 'confirm' && !validWorkoutRequestId(body.activity_id)) return 'Choose an imported activity.';
  if (typeof body.expected_updated_at !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T/.test(body.expected_updated_at)
    || !Number.isFinite(Date.parse(body.expected_updated_at))) return 'Reload the workout before changing its match.';
  return null;
}

export async function decideWorkoutMatch(admin, actorId, body) {
  const validation = validateMatchDecision(body);
  if (validation) return { status: 400, error: validation };
  const { data, error } = await admin.rpc('decide_workout_activity_match', {
    p_actor_id: actorId, p_workout_id: body.id, p_action: body.match_action,
    p_activity_id: body.match_action === 'confirm' ? body.activity_id : null,
    p_expected_updated_at: body.expected_updated_at,
  });
  if (!error) return { status: 200, workout: data };
  if (error.code === '23505') return { status: 409, error: 'This activity is already linked to another workout. Unlink it there first, then retry.' };
  if (['PT409','40001'].includes(error.code)) return { status: 409, error: 'This workout changed in another session. Close and reopen it before changing the match.' };
  if (error.code === '42501') return { status: 403, error: 'Only the athlete can change this workout match.' };
  if (error.code === '22023') return { status: 400, error: 'This imported activity is no longer available. Reload the calendar and choose another activity.' };
  console.error('[workout-match] save failed:', error.code);
  return { status: 503, error: 'Could not save the match. Your selection is still here; please retry.' };
}
