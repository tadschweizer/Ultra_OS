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

// Maps a raw activity sport label (Strava-style "Run"/"VirtualRide", or one of
// our own ids) onto our internal sport id, so a planned run only auto-fulfills
// from a run and not from, say, a bike ride on the same day.
const ACTIVITY_SPORT_ALIASES = {
  run: 'run', trailrun: 'run', virtualrun: 'run', treadmill: 'run',
  ride: 'bike', virtualride: 'bike', ebikeride: 'bike', gravelride: 'bike',
  mountainbikeride: 'bike', bike: 'bike', cycling: 'bike',
  swim: 'swim', openwaterswim: 'swim',
  walk: 'hike', hike: 'hike',
  rowing: 'row', row: 'row', kayaking: 'row',
  nordicski: 'ski', backcountryski: 'ski', alpineski: 'ski', ski: 'ski', rollerski: 'ski',
  weighttraining: 'strength', workout: 'strength', strengthtraining: 'strength', crossfit: 'strength',
};

export function normalizeSport(value) {
  if (!value) return null;
  const key = String(value).toLowerCase().replace(/[^a-z]/g, '');
  if (!key) return null;
  return ACTIVITY_SPORT_ALIASES[key] || key;
}

function activitySport(activity) {
  return normalizeSport(activity?.sport_type || activity?.type || activity?.sport);
}

function dayIndex(dateLike) {
  return Math.round(new Date(`${toDateKey(dateLike)}T00:00:00Z`).getTime() / 86400000);
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
 * The calendar day an activity belongs to, from the athlete's point of view.
 *
 * start_date is a UTC instant, so a 7pm session in a negative-offset timezone
 * carries the *next* UTC date and would be attributed to the wrong day. Stored
 * activities carry local_date (and start_date_local) for exactly this reason;
 * start_date is the last resort, for rows imported before those existed.
 */
export function activityDateKey(activity) {
  if (!activity) return null;
  if (activity.local_date) return String(activity.local_date).slice(0, 10);
  if (activity.start_date_local) return String(activity.start_date_local).slice(0, 10);
  return activity.start_date ? toDateKey(activity.start_date) : null;
}

/**
 * Matches synced activities to planned workouts of the same athlete.
 *
 * Strategy: an activity within `toleranceDays` of the plan (0 = same calendar
 * day only) fulfills it. When both the plan and the activity know their sport,
 * they must agree, so a run plan is never fulfilled by a bike ride. Among the
 * candidates the closest one wins — smaller date gap first, then the closest
 * duration. Each activity is consumed at most once, and the most specific
 * plans (longest planned duration) are matched first.
 *
 * Activities need: { id, start_date, moving_time (sec), distance? (m),
 * sport_type?/type?/sport? }. When a local_date / start_date_local is present
 * it wins over start_date — see activityDateKey.
 * Returns a Map of workout id -> activity.
 */
export function matchActivitiesToWorkouts(workouts = [], activities = [], { toleranceDays = 0 } = {}) {
  const matches = new Map();
  const used = new Set();
  const acts = activities.filter((a) => activityDateKey(a));

  // Match the most specific plans first (largest planned duration).
  const ordered = [...workouts].sort(
    (a, b) => (Number(b.planned_duration_min) || 0) - (Number(a.planned_duration_min) || 0)
  );

  ordered.forEach((workout) => {
    const planDay = dayIndex(workout.workout_date);
    const planSport = normalizeSport(workout.sport);
    const plannedMin = Number(workout.planned_duration_min) || 0;

    const score = (activity) => {
      const dayGap = Math.abs(dayIndex(activityDateKey(activity)) - planDay);
      const durGap = Math.abs((Number(activity.moving_time) || 0) / 60 - plannedMin);
      // Date proximity dominates; duration closeness breaks ties.
      return dayGap * 100000 + durGap;
    };

    const best = acts.reduce((bestSoFar, activity) => {
      if (used.has(activity.id)) return bestSoFar;
      if (Math.abs(dayIndex(activityDateKey(activity)) - planDay) > toleranceDays) return bestSoFar;
      const actSport = activitySport(activity);
      if (planSport && actSport && planSport !== actSport) return bestSoFar;
      if (!bestSoFar) return activity;
      return score(activity) < score(bestSoFar) ? activity : bestSoFar;
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
export function decorateWorkoutsWithCompliance(workouts = [], activities = [], { today = new Date(), toleranceDays = 0 } = {}) {
  const matches = matchActivitiesToWorkouts(
    workouts.filter((w) => w.status !== 'skipped' && !w.completed_activity_id),
    activities,
    { toleranceDays }
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
      // The calendar day this workout should render on: where it actually
      // happened when an activity fulfilled it (which may differ from the
      // planned day), otherwise the planned day.
      display_date: matched ? activityDateKey(matched) : toDateKey(workout.workout_date),
    };
    next.compliance_pct = compliancePct(next, {
      duration_min: next.completed_duration_min,
      distance_km: next.completed_distance_km,
    });
    next.compliance_status = complianceStatus(next, { today });
    return next;
  });
}

/**
 * Reconciliation rollup for a date window: which planned sessions happened,
 * which were missed, and which synced activities had no plan at all.
 *
 * Workouts and activities outside [start, end] (calendar-day keys) are
 * ignored. `today` drives the planned/missed split for past days.
 *
 * Returns:
 *  {
 *    plannedCount, completedCount, missedCount, upcomingCount,
 *    avgCompliancePct,            // mean of judgeable sessions, or null
 *    unplannedActivities: [...],  // synced activities with no matching plan
 *    workouts: [...],             // decorated (compliance fields attached)
 *    days: [{ key, workouts, unplannedActivities }]  // ascending by day
 *  }
 */
export function summarizeReconciliationWindow(workouts = [], activities = [], { start, end, today = new Date() } = {}) {
  const startKey = start ? toDateKey(start) : null;
  const endKey = end ? toDateKey(end) : null;
  const inWindow = (key) => Boolean(key) && (!startKey || key >= startKey) && (!endKey || key <= endKey);

  const windowWorkouts = workouts.filter((w) => inWindow(w?.workout_date ? toDateKey(w.workout_date) : null));
  const windowActivities = activities.filter((a) => inWindow(activityDateKey(a)));

  const decorated = decorateWorkoutsWithCompliance(windowWorkouts, windowActivities, { today });

  // Activities consumed by a plan — either auto-matched here or persisted
  // earlier as completed_activity_id (stored as text; Strava ids are numbers).
  const consumed = new Set();
  decorated.forEach((w) => {
    if (w.matched_activity?.id != null) consumed.add(String(w.matched_activity.id));
    if (w.completed_activity_id != null) consumed.add(String(w.completed_activity_id));
  });
  const unplannedActivities = windowActivities.filter((a) => !consumed.has(String(a.id)));

  const todayKey = toDateKey(today);
  let completedCount = 0;
  let missedCount = 0;
  let upcomingCount = 0;
  const pcts = [];

  decorated.forEach((w) => {
    if (w.status === 'completed') {
      completedCount += 1;
      if (Number.isFinite(w.compliance_pct)) pcts.push(w.compliance_pct);
    } else if (w.status === 'skipped' || toDateKey(w.workout_date) < todayKey) {
      missedCount += 1;
    } else {
      upcomingCount += 1;
    }
  });

  const days = new Map();
  const dayFor = (key) => {
    if (!days.has(key)) days.set(key, { key, workouts: [], unplannedActivities: [] });
    return days.get(key);
  };
  decorated.forEach((w) => dayFor(toDateKey(w.workout_date)).workouts.push(w));
  unplannedActivities.forEach((a) => dayFor(activityDateKey(a)).unplannedActivities.push(a));

  return {
    plannedCount: decorated.length,
    completedCount,
    missedCount,
    upcomingCount,
    avgCompliancePct: pcts.length ? Math.round(pcts.reduce((s, n) => s + n, 0) / pcts.length) : null,
    unplannedActivities,
    workouts: decorated,
    days: [...days.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
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
