// Recorded elapsed-time intervals. No resampling, invented sensor values, or
// default physiological thresholds. Gaps over 30 seconds are unobserved.
export const numberOrNull = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const channels = { hr: 'heartrate', power: 'watts', cadence: 'cadence', elevation: 'altitude', speed: 'velocity_smooth', distance: 'distance' };
export function chartDomain(points, key) {
  const values = points.map(p => p[key]).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return { low: 0, high: 1, clipped: false };
  let low = values[0], high = values.at(-1);
  // Pace is seconds/km. Ignore near-stationary readings when choosing the
  // viewport, but retain them for inspection and all recorded-time statistics.
  if (key === 'pace') {
    const moving = values.filter(v => v > 0 && v <= 1200);
    if (moving.length) {
      low = moving[0];
      high = Math.min(high, Math.max(low + 60, moving[Math.floor((moving.length - 1) * 0.9)] * 1.25));
    }
  }
  if (low === high) { const padding = Math.max(1, Math.abs(low) * 0.05); low -= padding; high += padding; }
  return { low, high, clipped: values.at(-1) > high };
}
export function sessionPoints(streams = {}) {
  const times = streams.time?.data;
  if (!Array.isArray(times)) return [];
  const points = [];
  times.slice(0, 200000).forEach((time, i) => {
    const t = numberOrNull(time);
    if (t == null || t < 0 || (points.length && t <= points.at(-1).t)) return;
    const point = { t };
    for (const [key, source] of Object.entries(channels)) {
      const value = numberOrNull(streams[source]?.data?.[i]);
      point[key] = value != null && (key === 'elevation' || value >= 0) && (key !== 'hr' || value > 0) ? value : null;
    }
    points.push(point);
  });
  return points;
}

export function rangeStats(points, start = points[0]?.t, end = points.at(-1)?.t) {
  const sums = {}, coverage = {};
  let distance = 0, distanceSeconds = 0, observed = 0;
  let lo = 0, hi = points.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (points[mid].t < start) lo = mid + 1; else hi = mid; }
  for (let i = Math.max(0, lo - 1); i < points.length - 1 && points[i].t < end; i++) {
    const p = points[i], next = points[i + 1], dt = next.t - p.t;
    const seconds = Math.min(end, next.t) - Math.max(start, p.t);
    if (seconds <= 0 || dt > 30) continue;
    observed += seconds;
    for (const key of ['hr', 'power', 'cadence', 'speed', 'elevation']) {
      if (p[key] == null) continue;
      sums[key] = (sums[key] || 0) + p[key] * seconds;
      coverage[key] = (coverage[key] || 0) + seconds;
    }
    if (p.distance != null && next.distance != null && next.distance >= p.distance) {
      distance += (next.distance - p.distance) * seconds / dt;
      distanceSeconds += seconds;
    }
  }
  const duration = Math.max(0, (end ?? 0) - (start ?? 0));
  return { start, end, duration, observed, distance: distanceSeconds ? distance : null, distanceSeconds,
    ...Object.fromEntries(['hr', 'power', 'cadence', 'speed', 'elevation'].map(key => [key, coverage[key] ? sums[key] / coverage[key] : null])),
    pace: distance > 0 ? distanceSeconds / distance * 1000 : null, coverage };
}

// Best recorded-start windows, using prefix integrals for irregular samples.
// Require complete channel coverage: a dropout must never improve an effort.
export function peakEfforts(points, channel = 'power', durations = [30, 60, 300, 1200]) {
  if (points.length < 2 || !['power', 'speed'].includes(channel)) return [];
  const sums = [0], covered = [0];
  for (let i = 0; i < points.length - 1; i++) {
    const dt = points[i + 1].t - points[i].t;
    const valid = dt <= 30 && points[i][channel] != null;
    sums.push(sums[i] + (valid ? dt * points[i][channel] : 0));
    covered.push(covered[i] + (valid ? dt : 0));
  }
  return durations.map(duration => {
    let best = null, j = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const end = points[i].t + duration;
      if (end > points.at(-1).t) break;
      j = Math.max(i, j);
      while (j + 1 < points.length && points[j + 1].t <= end) j++;
      const tail = end - points[j].t;
      const validTail = !tail || j + 1 < points.length && points[j + 1].t - points[j].t <= 30 && points[j][channel] != null;
      if (!validTail || Math.abs(covered[j] - covered[i] + tail - duration) > 0.001) continue;
      const average = (sums[j] - sums[i] + tail * (points[j][channel] ?? 0)) / duration;
      if (!best || average > best.average) best = { duration, start: points[i].t, end, average, channel };
    }
    return best;
  }).filter(Boolean);
}

export function plannedTimeSegments(workout, points) {
  const steps = workout?.structure;
  if (!Array.isArray(steps) || !steps.length || !points.length) return [];
  // Distance/open/repeating blocks cannot be placed confidently on elapsed time.
  if (steps.some(s => !(numberOrNull(s.duration_min) > 0) || s.distance_km || Number(s.repeat || 1) !== 1)) return [];
  let start = points[0].t;
  return steps.slice(0, 200).map((step, i) => {
    const end = start + Number(step.duration_min) * 60;
    const row = { label: step.type || `Step ${i + 1}`, target: [step.target_type, step.target_min, step.target_max != null ? `–${step.target_max}` : '', step.target_units].filter(v => v != null && v !== '').join(' '),
      ...rangeStats(points, start, Math.min(end, points.at(-1).t)), start, end: Math.min(end, points.at(-1).t) };
    start = end; return row;
  }).filter(row => row.end > row.start);
}

export function distanceSplits(points, meters = 1000) {
  if (!points.length || points[0].distance == null || ![1000, 1609.344].includes(meters)) return [];
  let start = points[0].t, boundary = points[0].distance + meters;
  const splits = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.distance == null || b.distance == null || b.distance < a.distance || b.t - a.t > 30) return []; // cannot locate a split across missing distance
    while (boundary <= b.distance && splits.length < 1000) {
      const end = a.t + (boundary - a.distance) / (b.distance - a.distance) * (b.t - a.t);
      splits.push({ label: String(splits.length + 1), ...rangeStats(points, start, end) });
      start = end; boundary += meters;
    }
    if (splits.length >= 1000) break;
  }
  if (points.at(-1).t > start && splits.length < 1000) splits.push({ label: `${splits.length + 1} (partial)`, ...rangeStats(points, start, points.at(-1).t) });
  return splits;
}

export function hrDistribution(points, settings = {}) {
  const limits = [settings.hr_zone_2_max, settings.hr_zone_3_min, settings.hr_zone_4_min].map(numberOrNull);
  if (limits.some(v => v == null || v <= 0) || limits[0] >= limits[1] || limits[1] >= limits[2]) return null;
  const bins = [0, 0, 0, 0];
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i], dt = points[i + 1].t - p.t;
    if (p.hr == null || dt > 30) continue;
    bins[p.hr <= limits[0] ? 0 : p.hr < limits[1] ? 1 : p.hr < limits[2] ? 2 : 3] += dt;
  }
  return bins.map((seconds, i) => ({ seconds, label: [`≤ ${limits[0]} bpm`, `> ${limits[0]} to < ${limits[1]} bpm`, `${limits[1]} to < ${limits[2]} bpm`, `≥ ${limits[2]} bpm`][i] }));
}

export function planComparison(workout, activity) {
  if (!workout) return [];
  return [
    ['Duration', numberOrNull(workout.planned_duration_min), activity?.moving_time != null ? numberOrNull(activity.moving_time) / 60 : numberOrNull(workout.completed_duration_min), 'min'],
    ['Distance', numberOrNull(workout.planned_distance_km), activity?.distance != null ? numberOrNull(activity.distance) / 1000 : numberOrNull(workout.completed_distance_km), 'km'],
  ].map(([label, planned, actual, unit]) => ({ label, planned, actual, unit, delta: planned != null && actual != null ? actual - planned : null }));
}
