import { computeActivityTrimp, ewmaSeries } from './trainingLoad';

/**
 * Server-side load rollup for /api/me. Shares the TRIMP + EWMA model with
 * lib/trainingLoad so the dashboard, calendar header, and progress page all
 * report the same fitness/fatigue/form numbers.
 *
 * Synced activities are the primary signal. Logged interventions (sauna,
 * fueling, recovery protocols) are NOT training stress, so they only fill in
 * as a rough fallback when an athlete has no synced activities at all.
 */

function toDateOnly(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseMinutes(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function interventionLoadScore(item) {
  const duration = parseMinutes(item?.dose_duration);
  const intensity = Number.isFinite(item?.subjective_feel) ? item.subjective_feel : 5;
  return duration * Math.max(1, intensity) / 6; // scale toward TRIMP range
}

export function buildDailyLoadSeries({ interventions = [], activities = [], lookbackDays = 42, now = new Date() } = {}) {
  const endDate = toDateOnly(now) || new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (lookbackDays - 1));

  const points = Array.from({ length: lookbackDays }).map((_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return {
      key: day.toISOString().slice(0, 10),
      load: 0,
    };
  });

  const pointMap = new Map(points.map((point) => [point.key, point]));

  const hasActivities = (activities || []).some((item) => Number(item?.moving_time) > 0);

  (activities || []).forEach((item) => {
    const date = toDateOnly(item.start_date || item.start_time || item.date);
    if (!date) return;
    const key = date.toISOString().slice(0, 10);
    if (!pointMap.has(key)) return;
    pointMap.get(key).load += computeActivityTrimp(item);
  });

  if (!hasActivities) {
    (interventions || []).forEach((item) => {
      const date = toDateOnly(item.date || item.inserted_at);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      if (!pointMap.has(key)) return;
      pointMap.get(key).load += interventionLoadScore(item);
    });
  }

  return points;
}

export function buildLoadMetrics(payload = {}) {
  const daily = buildDailyLoadSeries(payload);
  const loads = daily.map((point) => point.load);
  const acuteSeries = ewmaSeries(loads, 7);
  const chronicSeries = ewmaSeries(loads, 42);
  const latestIndex = daily.length - 1;
  const acute = acuteSeries[latestIndex] || 0;
  const chronic = chronicSeries[latestIndex] || 0;
  const form = chronic - acute;

  return {
    acute: Number(acute.toFixed(1)),
    chronic: Number(chronic.toFixed(1)),
    form: Number(form.toFixed(1)),
    sparkline: daily.map((point, idx) => ({
      date: point.key,
      load: Number(point.load.toFixed(1)),
      acute: Number((acuteSeries[idx] || 0).toFixed(1)),
      chronic: Number((chronicSeries[idx] || 0).toFixed(1)),
    })),
    explainability: 'Exponentially-weighted training load from synced activities (7-day fatigue vs 42-day fitness).',
  };
}

export function buildLoadStatus(metrics) {
  if (!metrics) return { label: 'Unknown', tone: 'neutral' };
  if (metrics.form < -30) return { label: 'High strain', tone: 'red' };
  if (metrics.form < -10) return { label: 'Productive build', tone: 'green' };
  if (metrics.form > 15) return { label: 'Detraining risk', tone: 'yellow' };
  if (metrics.form > 5) return { label: 'Fresh', tone: 'green' };
  return { label: 'Balanced', tone: 'green' };
}
