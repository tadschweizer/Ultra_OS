import { validateWorkoutFields } from './workoutValidation.js';

export function canMoveCalendarWorkout(workout, role, coachId) {
  return Boolean(workout && (workout.status === 'planned' || workout.activity_match_state === 'suggested') && !workout.completed_activity_id
    && (role === 'athlete' || (coachId && workout.coach_id === coachId)));
}

export async function moveCalendarWorkout(admin, actorId, body) {
  if (!body.workout_date || validateWorkoutFields({ workout_date: body.workout_date })
    || typeof body.expected_updated_at !== 'string' || !Number.isFinite(Date.parse(body.expected_updated_at))) {
    return { status: 400, error: 'Choose a valid date and reload the workout before moving it.' };
  }
  const { data, error } = await admin.rpc('move_calendar_workout', {
    p_actor_id: actorId, p_workout_id: body.id, p_date: body.workout_date,
    p_expected_updated_at: body.expected_updated_at,
  });
  if (!error) return { status: 200, workout: data };
  if (error.code === '42501') return { status: 403, error: 'Only the athlete or assigning coach can move this workout.' };
  if (error.code === 'PT409') return { status: 409, error: 'This workout changed or was completed. Refresh the calendar before moving it.' };
  if (error.code === '22023') return { status: 400, error: 'Choose a valid destination date.' };
  return { status: 503, error: 'The move was not confirmed. Refresh the calendar, then retry if needed.' };
}
