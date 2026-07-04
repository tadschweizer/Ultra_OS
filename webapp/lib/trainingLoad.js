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
    hrReserve = 0.5; // no HR data — assume steady aerobic work
  }

  return minutes * hrReserve * 0.64 * Math.exp(1.92 * hrReserve);
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
