const DAY_MS = 86400000;

function toDateOnly(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function parseMinutes(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function interventionLoadScore(item) {
  const duration = parseMinutes(item?.dose_duration);
  const intensity = Number.isFinite(item?.subjective_feel) ? item.subjective_feel : 5;
  return duration * Math.max(1, intensity);
}

function activityLoadScore(item) {
  const movingTimeMinutes = Number(item?.moving_time || 0) / 60;
  const intensity = Number.isFinite(item?.perceived_exertion) ? item.perceived_exertion : 5;
  return movingTimeMinutes * Math.max(1, intensity);
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

  interventions.forEach((item) => {
    const date = toDateOnly(item.date || item.inserted_at);
    if (!date) return;
    const key = date.toISOString().slice(0, 10);
    if (!pointMap.has(key)) return;
    pointMap.get(key).load += interventionLoadScore(item);
  });

  activities.forEach((item) => {
    const date = toDateOnly(item.start_date || item.start_time || item.date);
    if (!date) return;
    const key = date.toISOString().slice(0, 10);
    if (!pointMap.has(key)) return;
    pointMap.get(key).load += activityLoadScore(item);
  });

  return points;
}

function rollingAverage(points, windowDays) {
  return points.map((point, idx) => {
    const start = Math.max(0, idx - windowDays + 1);
    const slice = points.slice(start, idx + 1);
    const total = slice.reduce((sum, entry) => sum + entry.load, 0);
    return total / Math.max(slice.length, 1);
  });
}

export function buildLoadMetrics(payload = {}) {
  const daily = buildDailyLoadSeries(payload);
  const acuteSeries = rollingAverage(daily, 7);
  const chronicSeries = rollingAverage(daily, 28);
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
    explainability: 'Based on your logged duration × intensity, plus synced activities when available',
  };
}

export function buildLoadStatus(metrics) {
  if (!metrics) return { label: 'Unknown', tone: 'neutral' };
  if (metrics.form < -15) return { label: 'High strain', tone: 'red' };
  if (metrics.form < -5) return { label: 'Building', tone: 'yellow' };
  if (metrics.form > 20) return { label: 'Detraining risk', tone: 'yellow' };
  return { label: 'Balanced', tone: 'green' };
}
