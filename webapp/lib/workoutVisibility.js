// Pass coachId only after verifying the caller's active relationship. A private
// draft belongs to its assigning coach; another linked coach cannot read it.
export function canReadWorkout(workout, { athleteId, coachId = null } = {}) {
  if (!workout) return false;
  const visible = workout.visibility == null || workout.visibility === 'athlete_visible';
  if (coachId) return visible || workout.coach_id === coachId;
  return visible && workout.athlete_id === athleteId;
}

export function filterReadableWorkouts(workouts, access) {
  return (workouts || []).filter((workout) => canReadWorkout(workout, access));
}
