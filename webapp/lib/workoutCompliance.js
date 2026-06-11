/**
 * Pure helpers for the training calendar: structured-workout totals, TSS
 * estimation, planned-vs-completed compliance, and matching synced
 * activities to planned workouts.
 */

export const WORKOUT_SPORTS = [
  { id: 'run', label: 'Run' },
  { id: 'bike', label: 'Bike' },
  { id: 'swim', label: 'Swim' },
  { id: 'strength', label: 'Strength' },
  { id: 'row', label: 'Row' },
  { id: 'ski', label: 'Ski' },
  { id: 'hike', label: 'Hike' },
  { id: 'other', label: 'Other' },
];

export const STEP_TYPES = [
  { id: 'warmup', label: 'Warm up' },
  { id: 'work', label: 'Work' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'cooldown', label: 'Cool down' },
  { id: 'rest', label: 'Rest' },
];

export const INTENSITY_ZONES = [
  { id: 'easy', label: 'Easy / Z1', factor: 0.55 },
  { id: 'z2', label: 'Endurance / Z2', factor: 0.7 },
  { id: 'tempo', label: 'Tempo / Z3', factor: 0.8 },
  { id: 'threshold', label: 'Threshold / Z4', factor: 0.95 },
  { id: 'vo2', label: 'VO2max / Z5', factor: 1.1 },
];

function intensityFactor(intensity) {
  return INTENSITY_ZONES.find((z) => z.id === intensity)?.factor ?? 0.7;
}

/** Sums duration/distance across structure steps, honoring repeats. */
export function summarizeStructure(structure = []) {
  let durationMin = 0;
  let distanceKm = 0;
  (Array.isArray(structure) ? structure : []).forEach((step) => {
    const repeat = Math.max(1, Number(step?.repeat) || 1);
    durationMin += repeat * (Number(step?.duration_min) || 0);
    distanceKm += repeat * (Number(step?.distance_km) || 0);
  });
  return {
    durationMin: Math.round(durationMin * 10) / 10,
    distanceKm: Math.round(distanceKm * 100) / 100,
  };
}

/**
 * Training Stress Score estimate: TSS = hours * IF^2 * 100, computed per
 * structure step so interval sessions score higher than easy volume.
 */
export function estimateTss(structure = [], fallbackDurationMin = null) {
  const steps = Array.isArray(structure) ? structure : [];
  if (!steps.length) {
    if (!fallbackDurationMin) return null;
    return Math.round((fallbackDurationMin / 60) * 0.7 ** 2 * 100);
  }
  let tss = 0;
  steps.forEach((step) => {
    const repeat = Math.max(1, Number(step?.repeat) || 1);
    const hours = (repeat * (Number(step?.duration_min) || 0)) / 60;
    if (step?.type === 'rest') return;
    tss += hours * intensityFactor(step?.intensity) ** 2 * 100;
  });
  return Math.round(tss);
}

/**
 * Compliance percentage of completed vs planned duration (distance used as
 * fallback when no planned duration exists). Returns null when there is
 * nothing to compare.
 */
export function compliancePct(planned, completed) {
  const plannedDuration = Number(planned?.planned_duration_min) || 0;
  const completedDuration = Number(completed?.duration_min) || 0;
  if (plannedDuration > 0 && completedDuration > 0) {
    return Math.round((completedDuration / plannedDuration) * 100);
  }
  const plannedDistance = Number(planned?.planned_distance_km) || 0;
  const completedDistance = Number(completed?.distance_km) || 0;
  if (plannedDistance > 0 && completedDistance > 0) {
    return Math.round((completedDistance / plannedDistance) * 100);
  }
  return null;
}

/**
 * TrainingPeaks-style compliance colors:
 *  - green:  completed within 80–120% of the plan
 *  - yellow: 50–80% or 120–150%
 *  - red:    < 50%, > 150%, or skipped/missed (past, never completed)
 *  - none:   future or unjudgeable
 */
export function complianceStatus(workout, { today = new Date() } = {}) {
  const todayKey = toDateKey(today);
  const isPast = workout.workout_date < todayKey;

  if (workout.status === 'skipped') return 'red';

  const pct = workout.compliance_pct ?? compliancePct(workout, {
    duration_min: workout.completed_duration_min,
    distance_km: workout.completed_distance_km,
  });

  if (workout.status === 'completed') {
    if (pct === null) return 'green';
    if (pct >= 80 && pct <= 120) return 'green';
    if ((pct >= 50 && pct < 80) || (pct > 120 && pct <= 150)) return 'yellow';
    return 'red';
  }

  // Still "planned"
  if (isPast) return 'red';
  return 'none';
}

export function toDateKey(date) {
  if (typeof date === 'string') return date.slice(0, 10);
  const d = new Date(date);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/**
 * Matches synced activities to planned workouts of the same athlete.
 * Strategy: same calendar day; prefer the activity whose duration is closest
 * to the plan; each activity is consumed at most once.
 *
 * Activities need: { id, start_date, moving_time (sec), distance? (m) }.
 * Returns a Map of workout id -> activity.
 */
export function matchActivitiesToWorkouts(workouts = [], activities = []) {
  const matches = new Map();
  const used = new Set();

  const byDay = new Map();
  activities.forEach((activity) => {
    if (!activity?.start_date) return;
    const key = toDateKey(activity.start_date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(activity);
  });

  // Match the most specific plans first (largest planned duration).
  const ordered = [...workouts].sort(
    (a, b) => (Number(b.planned_duration_min) || 0) - (Number(a.planned_duration_min) || 0)
  );

  ordered.forEach((workout) => {
    const candidates = (byDay.get(toDateKey(workout.workout_date)) || []).filter(
      (activity) => !used.has(activity.id)
    );
    if (!candidates.length) return;

    const plannedMin = Number(workout.planned_duration_min) || 0;
    const best = candidates.reduce((bestSoFar, activity) => {
      if (!bestSoFar) return activity;
      const a = Math.abs((Number(activity.moving_time) || 0) / 60 - plannedMin);
      const b = Math.abs((Number(bestSoFar.moving_time) || 0) / 60 - plannedMin);
      return a < b ? activity : bestSoFar;
    }, null);

    if (best) {
      used.add(best.id);
      matches.set(workout.id, best);
    }
  });

  return matches;
}

/**
 * Decorates planned workouts with completion data from matched activities
 * and a computed compliance percentage + status color.
 */
export function decorateWorkoutsWithCompliance(workouts = [], activities = [], { today = new Date() } = {}) {
  const matches = matchActivitiesToWorkouts(
    workouts.filter((w) => w.status !== 'skipped' && !w.completed_activity_id),
    activities
  );

  return workouts.map((workout) => {
    const matched = matches.get(workout.id) || null;
    const completedDuration = workout.completed_duration_min
      ?? (matched ? Math.round(((Number(matched.moving_time) || 0) / 60) * 10) / 10 : null);
    const completedDistance = workout.completed_distance_km
      ?? (matched?.distance ? Math.round((Number(matched.distance) / 1000) * 100) / 100 : null);

    const next = {
      ...workout,
      matched_activity: matched,
      completed_duration_min: completedDuration,
      completed_distance_km: completedDistance,
      // A matched activity implies the session happened even if the athlete
      // never pressed "complete".
      status: workout.status === 'planned' && matched ? 'completed' : workout.status,
    };
    next.compliance_pct = compliancePct(next, {
      duration_min: next.completed_duration_min,
      distance_km: next.completed_distance_km,
    });
    next.compliance_status = complianceStatus(next, { today });
    return next;
  });
}

/** Weekly rollup of planned vs completed totals for a list of workouts. */
export function summarizeWeek(workouts = []) {
  const summary = {
    plannedDurationMin: 0,
    completedDurationMin: 0,
    plannedDistanceKm: 0,
    completedDistanceKm: 0,
    plannedTss: 0,
    completedCount: 0,
    totalCount: workouts.length,
  };
  workouts.forEach((w) => {
    summary.plannedDurationMin += Number(w.planned_duration_min) || 0;
    summary.plannedDistanceKm += Number(w.planned_distance_km) || 0;
    summary.plannedTss += Number(w.planned_tss) || 0;
    if (w.status === 'completed') {
      summary.completedCount += 1;
      summary.completedDurationMin += Number(w.completed_duration_min) || 0;
      summary.completedDistanceKm += Number(w.completed_distance_km) || 0;
    }
  });
  summary.compliancePct = summary.plannedDurationMin > 0
    ? Math.round((summary.completedDurationMin / summary.plannedDurationMin) * 100)
    : null;
  return summary;
}
