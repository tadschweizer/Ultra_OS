import { summarizeWeek, summarizeActualTss } from './workoutCompliance.js';

const sumBy = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);

/** Actuals combine completed plans and activities not already attributed to a
 * plan. Recorded elevation/work must also follow an activity into its plan. */
export function summarizeCalendarWeek(days) {
  const workouts = days.flatMap((day) => day.workouts);
  const planned = summarizeWeek(workouts);
  const imported = days.flatMap((day) => day.activities);
  const completedWorkouts = workouts.filter((workout) => workout.status === 'completed');
  const actualDurationMin = planned.completedDurationMin + sumBy(imported, (activity) => activity.duration_min);
  const actualDistanceKm = planned.completedDistanceKm + sumBy(imported, (activity) => activity.distance_km);
  const actualLoad = summarizeActualTss(completedWorkouts, imported);

  // These fields are recorded on the activity, not duplicated onto the plan.
  // Identity deduplication also protects legacy rows or repeated references.
  const recorded = new Map();
  for (const activity of [...imported, ...completedWorkouts.map((workout) => workout.linked_activity || workout.matched_activity)]) {
    if (activity) {
      const key = activity.id == null ? activity : String(activity.id);
      if (!recorded.has(key)) recorded.set(key, activity);
    }
  }
  const recordedActivities = [...recorded.values()];

  const bySport = new Map();
  const addSport = (sport, durationMin, distanceKm) => {
    const key = sport || 'other';
    const current = bySport.get(key) || { sport: key, durationMin: 0, distanceKm: 0, count: 0 };
    current.durationMin += Number(durationMin) || 0;
    current.distanceKm += Number(distanceKm) || 0;
    current.count++;
    bySport.set(key, current);
  };
  completedWorkouts.forEach((workout) => addSport(workout.sport, workout.completed_duration_min, workout.completed_distance_km));
  imported.forEach((activity) => addSport(activity.sport, activity.duration_min, activity.distance_km));
  return {
    ...planned,
    completedSessionCount: planned.completedCount + imported.length,
    importedActivityCount: imported.length,
    actualDurationMin,
    actualDistanceKm,
    actualTss: actualLoad.tss,
    missingActualTssCount: actualLoad.missingCount,
    elevationGainM: sumBy(recordedActivities, (activity) => activity.elevation_gain_m ?? activity.total_elevation_gain),
    kilojoules: sumBy(recordedActivities, (activity) => activity.kilojoules),
    sports: [...bySport.values()].sort((a, b) => b.durationMin - a.durationMin),
    hasActuals: planned.completedCount + imported.length > 0,
  };
}
