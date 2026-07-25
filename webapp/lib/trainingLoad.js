/**
 * Training load model (Banister / Coggan performance-management style).
 *
 * Per-activity load is a TRIMP score: minutes × heart-rate-reserve factor
 * (exponentially weighted, so hard sessions count more than easy volume).
 * Daily loads feed exponentially-weighted moving averages:
 *   ATL (fatigue)  — 7-day time constant
 *   CTL (fitness)  — 42-day time constant
 *   TSB (form)     — CTL − ATL  (negative = carrying fatigue, positive = fresh)
 *
 * This replaces the previous simple-average implementation, which weighted a
 * six-week-old run the same as yesterday's and ignored intensity entirely.
 */

export const loadStatusConfig = {
  fresh: { label: 'Fresh / Race ready', tone: 'text-sky-700 bg-sky-50 border-sky-200' },
  balanced: { label: 'Balanced', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  productive: { label: 'Productive build', tone: 'text-blue-700 bg-blue-50 border-blue-200' },
  overreaching: { label: 'Overreaching', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  detraining: { label: 'Detraining risk', tone: 'text-rose-700 bg-rose-50 border-rose-200' },
};

const DEFAULT_RESTING_HR = 60;
const DEFAULT_MAX_HR = 190;
// Assumed fraction of heart-rate reserve for a session with neither HR nor RPE.
const DEFAULT_INTENSITY_WITHOUT_HR = 0.5;

function localDateKey(date) {
  const d = new Date(date);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function startOfDay(dateLike) { const d = new Date(dateLike); d.setHours(0, 0, 0, 0); return d; }

/**
 * Banister TRIMP for one activity. Uses the athlete's real resting/max HR
 * when configured; falls back to population defaults so the series still
 * works pre-onboarding. Activities without HR score on duration alone at a
 * moderate-intensity assumption.
 */
export function computeActivityTrimp(activity, settings = {}) {
  const minutes = (Number(activity?.moving_time) || 0) / 60;
  if (minutes <= 0) return 0;

  const restingHr = Number(settings?.resting_hr) || DEFAULT_RESTING_HR;
  const maxHr = Number(settings?.max_hr) || DEFAULT_MAX_HR;
  const avgHr = Number(activity?.average_heartrate) || 0;

  let hrReserve;
  if (avgHr > restingHr && maxHr > restingHr) {
    hrReserve = Math.min(1, (avgHr - restingHr) / (maxHr - restingHr));
  } else {
    // No HR data: perceived exertion (RPE 1–10) separates hard sessions from
    // easy ones; otherwise assume steady aerobic work.
    const rpe = Number(activity?.perceived_exertion) || 0;
    hrReserve = rpe > 0 ? Math.min(0.95, Math.max(0.3, rpe / 10)) : DEFAULT_INTENSITY_WITHOUT_HR;
  }

  return minutes * hrReserve * 0.64 * Math.exp(1.92 * hrReserve);
}

/**
 * Per-activity load stored at import time, so the calendar can total a week
 * without recomputing every session on each render.
 *
 * Returns the same TRIMP unit the rest of the load model uses (labelled TSS in
 * the UI) plus the intensity factor it was derived from — the fraction of
 * heart-rate reserve the session was held at.
 */
export function estimateTssFromActivity({ movingTimeSec = null, averageHeartrate = null, sportType = null } = {}, settings = {}) {
  const minutes = (Number(movingTimeSec) || 0) / 60;
  if (minutes <= 0) return { tss: null, intensityFactor: null };

  const restingHr = Number(settings?.resting_hr) || DEFAULT_RESTING_HR;
  const maxHr = Number(settings?.max_hr) || DEFAULT_MAX_HR;
  const avgHr = Number(averageHeartrate) || 0;

  const intensityFactor = avgHr > restingHr && maxHr > restingHr
    ? Math.min(1, (avgHr - restingHr) / (maxHr - restingHr))
    : DEFAULT_INTENSITY_WITHOUT_HR;

  const tss = computeActivityTrimp(
    { moving_time: Number(movingTimeSec) || 0, average_heartrate: avgHr, sport_type: sportType },
    settings
  );

  return {
    tss: Math.round(tss * 10) / 10,
    intensityFactor: Math.round(intensityFactor * 1000) / 1000,
  };
}

export function buildDailyLoad(activities = [], days = 84, settings = {}) {
  const today = startOfDay(new Date());
  const byDay = new Map();
  activities.forEach((activity) => {
    if (!activity?.start_date) return;
    const dayKey = String(activity.start_date).slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + computeActivityTrimp(activity, settings));
  });

  return Array.from({ length: days }).map((_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - idx - 1));
    const key = localDateKey(date);
    return { date: key, load: Number((byDay.get(key) || 0).toFixed(1)) };
  });
}

/** Exponentially-weighted moving average with a given time constant (days). */
export function ewmaSeries(values = [], timeConstant = 7, seed = 0) {
  const alpha = 1 - Math.exp(-1 / timeConstant);
  let prev = seed;
  return values.map((value) => {
    prev = prev + alpha * ((Number(value) || 0) - prev);
    return prev;
  });
}

export function getLoadStatus(form, chronic = null) {
  if (chronic !== null && chronic < 10) return 'balanced'; // not enough history to judge
  if (form > 15) return 'detraining';
  if (form > 5) return 'fresh';
  if (form >= -10) return 'balanced';
  if (form >= -30) return 'productive';
  return 'overreaching';
}

export function getLoadMetrics(activities = [], settings = {}) {
  const dailyLoad = buildDailyLoad(activities, 84, settings);
  const loads = dailyLoad.map((d) => d.load);

  const acuteSeries = ewmaSeries(loads, 7);
  const chronicSeries = ewmaSeries(loads, 42);
  const acute = acuteSeries[acuteSeries.length - 1] || 0;
  const chronic = chronicSeries[chronicSeries.length - 1] || 0;
  const form = chronic - acute;
  const formSeries = chronicSeries.map((c, i) => c - acuteSeries[i]);

  const statusKey = getLoadStatus(form, chronic);
  return {
    dailyLoad,
    acuteSeries,
    chronicSeries,
    formSeries,
    acute,
    chronic,
    form,
    statusKey,
    status: loadStatusConfig[statusKey],
  };
}

/** @deprecated kept for backwards compatibility; prefer ewmaSeries. */
export function rollingAverageFromDailyLoad(dailyLoad = [], window = 7) {
  return ewmaSeries(dailyLoad.map((d) => d.load), window);
}

// ─── Training-load spike detection ────────────────────────────────────────────

// Exact labels from lib/interventionCatalog.js that count as recovery-focused
// entries when cross-referencing a load spike week.
export const RECOVERY_INTERVENTION_TYPES = new Set([
  'Sleep Protocol',
  'Massage Gun',
  'Normatec / Pneumatic Compression',
  'Ice Bath / Cold Immersion',
  'Contrast Therapy',
  'Sauna - Recovery',
  'Compression Garments',
  'Elevation / Legs Up',
  'Stretching / Mobility',
  'Foam Rolling',
]);

const METERS_PER_MILE = 1609.34;
const BASELINE_WEEKS = 4;
// A near-zero baseline (returning from a break) makes ramp percentages absurd;
// below this weekly TRIMP the athlete needs different messaging, not a spike alert.
const MIN_BASELINE_TRIMP = 50;
const MIN_NONZERO_BASELINE_WEEKS = 3;
const RAMP_NOTE_PCT = 10;
const RAMP_MODERATE_PCT = 15;
const RAMP_HIGH_PCT = 30;

/** Monday-start week key (athlete-local date) for any date-like input. */
function mondayKey(dateLike) {
  const d = new Date(dateLike);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateKey(d);
}

function buildWeeklyBuckets(activities, settings, weekCount, today) {
  const currentMonday = new Date(today);
  currentMonday.setHours(0, 0, 0, 0);
  currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));

  const weeks = Array.from({ length: weekCount }).map((_, idx) => {
    const start = new Date(currentMonday);
    start.setDate(currentMonday.getDate() - (weekCount - 1 - idx) * 7);
    return { key: localDateKey(start), trimp: 0, miles: 0 };
  });
  const byKey = new Map(weeks.map((w) => [w.key, w]));

  activities.forEach((activity) => {
    if (!activity?.start_date) return;
    const trimp = computeActivityTrimp(activity, settings);
    if (!Number.isFinite(trimp) || trimp <= 0) return;
    const week = byKey.get(mondayKey(activity.start_date));
    if (!week) return;
    week.trimp += trimp;
    week.miles += (Number(activity.distance) || 0) / METERS_PER_MILE;
  });

  return weeks;
}

function severityForRamp(rampPct) {
  if (rampPct > RAMP_HIGH_PCT) return 'high';
  if (rampPct > RAMP_MODERATE_PCT) return 'moderate';
  if (rampPct > RAMP_NOTE_PCT) return 'note';
  return null;
}

function evaluateWeek(weeks, weekIdx) {
  if (weekIdx < BASELINE_WEEKS) return null;
  const target = weeks[weekIdx];
  const baselineWeeks = weeks.slice(weekIdx - BASELINE_WEEKS, weekIdx);
  if (baselineWeeks.filter((w) => w.trimp > 0).length < MIN_NONZERO_BASELINE_WEEKS) return null;

  const baselineLoad = baselineWeeks.reduce((sum, w) => sum + w.trimp, 0) / BASELINE_WEEKS;
  if (baselineLoad < MIN_BASELINE_TRIMP) return null;

  const rampPct = ((target.trimp - baselineLoad) / baselineLoad) * 100;
  const severity = severityForRamp(rampPct);
  if (!severity) return null;

  return {
    rampPct: Math.round(rampPct),
    weekLoad: Math.round(target.trimp),
    baselineLoad: Math.round(baselineLoad),
    weekMiles: Math.round(target.miles),
    baselineMiles: Math.round(baselineWeeks.reduce((sum, w) => sum + w.miles, 0) / BASELINE_WEEKS),
    severity,
    weekStart: target.key,
  };
}

function buildSpikeNarrative(spike, recoveryCount, recoveryTypes) {
  const weekLabel = spike.isCurrentWeek ? 'this week so far' : 'last week';
  const volume = spike.weekMiles > 0
    ? `${spike.weekMiles} mi`
    : `${spike.weekLoad} TRIMP`;
  const baselineVolume = spike.weekMiles > 0
    ? `${spike.baselineMiles} mi`
    : `${spike.baselineLoad} TRIMP`;
  const recoveryClause = recoveryCount > 0
    ? `You logged ${recoveryCount} recovery-focused ${recoveryCount === 1 ? 'entry' : 'entries'} ${spike.isCurrentWeek ? 'this week' : 'that week'} (${recoveryTypes.join(', ')}) — good.`
    : `No recovery interventions logged ${spike.isCurrentWeek ? 'this week' : 'that week'} — consider a recovery-focused entry.`;

  return `Your training load ${weekLabel} (${volume}) is ${spike.rampPct}% above your 4-week average (${baselineVolume}). That's above the recommended ~10% weekly ramp ceiling. ${recoveryClause}`;
}

/**
 * Flag the most recent week (current-partial or last complete) whose load
 * jumps >10% over the prior 4-week average, cross-referenced against logged
 * recovery interventions. Pure function; returns null when no spike.
 */
export function detectLoadSpikes(activities = [], settings = {}, interventions = [], { today = new Date() } = {}) {
  // Current week + 5 prior: enough history to evaluate both the current week
  // and the last complete week against their own 4-week baselines.
  const weeks = buildWeeklyBuckets(activities, settings, 6, today);

  // A partial current week that already exceeds the threshold is a real spike
  // and more actionable than last week's; otherwise fall back to the last
  // complete week.
  const currentSpike = evaluateWeek(weeks, weeks.length - 1);
  const completeSpike = evaluateWeek(weeks, weeks.length - 2);
  const spike = currentSpike
    ? { ...currentSpike, isCurrentWeek: true }
    : completeSpike
      ? { ...completeSpike, isCurrentWeek: false }
      : null;
  if (!spike) return null;

  const weekInterventions = interventions.filter((item) => {
    if (!item?.date || !item?.intervention_type) return false;
    return mondayKey(`${String(item.date).slice(0, 10)}T12:00:00`) === spike.weekStart;
  });
  const recoveryLogs = weekInterventions.filter((item) => RECOVERY_INTERVENTION_TYPES.has(item.intervention_type));
  const recoveryTypes = [...new Set(recoveryLogs.map((item) => item.intervention_type))];

  return {
    ...spike,
    recoveryCount: recoveryLogs.length,
    recoveryTypes,
    narrative: buildSpikeNarrative(spike, recoveryLogs.length, recoveryTypes),
  };
}
