import { computeActivityTrimp, ewmaSeries } from './trainingLoad.js';

// Only recorded training actuals enter this estimate. Recovery/intervention
// logs never substitute for training; input coverage travels with the output.
function dateKey(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}
function positiveNumber(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function rollup({ activities = [], workouts = [], lookbackDays = 42, now = new Date(), settings = {} } = {}) {
  const days = Number.isInteger(lookbackDays) && lookbackDays > 0 && lookbackDays <= 366 ? lookbackDays : 42;
  const end = new Date(`${dateKey(now) || dateKey(new Date())}T00:00:00Z`);
  const daily = Array.from({ length: days }, (_, i) => ({
    key: new Date(end.getTime() - (days - i - 1) * 86400000).toISOString().slice(0, 10), load: 0, missing_duration_count: 0,
  }));
  const points = new Map(daily.map(point => [point.key, point]));
  const coverage = { synced_count: 0, manual_count: 0, matched_plan_count: 0, duplicate_activity_count: 0,
    missing_duration_count: 0, estimated_intensity_count: 0, unresolved_link_count: 0, linked_outside_window_count: 0, window_days: days };
  const seen = new Set(), contributed = new Set(), activityDates = new Map();
  function add(day, item, kind) {
    if (!points.has(day)) return false;
    if (!positiveNumber(item.moving_time)) {
      coverage.missing_duration_count++; points.get(day).missing_duration_count++; return false;
    }
    const resting = positiveNumber(settings.resting_hr) || 60;
    const max = positiveNumber(settings.max_hr) || 190;
    const hasHr = positiveNumber(item.average_heartrate) > resting && max > resting;
    const rpe = positiveNumber(item.perceived_exertion);
    if (!hasHr && !(rpe >= 1 && rpe <= 10)) coverage.estimated_intensity_count++;
    points.get(day).load += computeActivityTrimp({ ...item, perceived_exertion: rpe >= 1 && rpe <= 10 ? rpe : null }, settings);
    coverage[kind]++;
    return true;
  }
  for (const item of activities || []) {
    const day = dateKey(item.local_date || item.start_date_local || item.start_date || item.start_time || item.date);
    const id = item.id == null ? null : String(item.id);
    if (id && seen.has(id)) { coverage.duplicate_activity_count++; continue; }
    if (id) { seen.add(id); activityDates.set(id, day); }
    if (add(day, item, 'synced_count') && id) contributed.add(id);
  }
  const seenWorkouts = new Set();
  for (const item of workouts || []) {
    if (item.status !== 'completed' || (item.visibility != null && item.visibility !== 'athlete_visible')) continue;
    if (item.id && seenWorkouts.has(item.id)) continue;
    if (item.id) seenWorkouts.add(item.id);
    const linked = item.completed_activity_id == null ? null : String(item.completed_activity_id);
    // A confirmed import has its own training date. Missing/out-of-window
    // imports must never reappear as manual load on the plan's scheduled day.
    if (linked && !activityDates.get(linked)) { coverage.unresolved_link_count++; continue; }
    if (linked && !points.has(activityDates.get(linked))) { coverage.linked_outside_window_count++; continue; }
    if (linked && contributed.has(linked)) { coverage.matched_plan_count++; continue; }
    const day = (linked && activityDates.get(linked)) || dateKey(item.workout_date);
    const minutes = positiveNumber(item.completed_duration_min);
    add(day, { moving_time: minutes == null ? null : minutes * 60, perceived_exertion: item.athlete_rpe }, 'manual_count');
  }
  const hasData = coverage.synced_count + coverage.manual_count > 0;
  const source = coverage.synced_count ? (coverage.manual_count ? 'mixed' : 'synced_activities')
    : coverage.manual_count ? 'manual_completions' : 'none';
  return { daily, hasData, provenance: { source, ...coverage } };
}

export function buildDailyLoadSeries(payload = {}) { return rollup(payload).daily; }

export function buildLoadMetrics(payload = {}) {
  const { daily, hasData, provenance } = rollup(payload);
  const acuteSeries = ewmaSeries(daily.map(point => point.load), 7);
  const chronicSeries = ewmaSeries(daily.map(point => point.load), 42);
  const acute = acuteSeries.at(-1) || 0, chronic = chronicSeries.at(-1) || 0;
  const sourceLabel = { none: 'No recorded training duration available.', synced_activities: 'Synced activities.',
    manual_completions: 'Manual workout completions.', mixed: 'Synced activities and manual workout completions.' }[provenance.source];
  const explanation = hasData
    ? `${sourceLabel} Estimated training load from actual duration and recorded HR/RPE, using default HR baselines unless supplied. 7-day fatigue vs 42-day fitness; unrecorded days treated as zero.`
    : sourceLabel;
  const missing = provenance.missing_duration_count ? ` ${provenance.missing_duration_count} session(s) without actual duration excluded.` : '';
  const estimates = provenance.estimated_intensity_count ? ` Default intensity assumed for ${provenance.estimated_intensity_count} session(s) without HR/RPE.` : '';
  const unresolved = provenance.unresolved_link_count ? ` ${provenance.unresolved_link_count} session(s) linked to unavailable imports or activity dates excluded.` : '';
  const outside = provenance.linked_outside_window_count ? ` ${provenance.linked_outside_window_count} linked session(s) outside this ${provenance.window_days}-day window excluded.` : '';
  return {
    acute: hasData ? Number(acute.toFixed(1)) : null,
    chronic: hasData ? Number(chronic.toFixed(1)) : null,
    form: hasData ? Number((chronic - acute).toFixed(1)) : null,
    has_data: hasData, coverage: !hasData ? 'none' : (provenance.missing_duration_count || provenance.unresolved_link_count) ? 'partial' : 'recorded', provenance,
    source_label: sourceLabel,
    sparkline: daily.map((point, i) => ({ date: point.key, load: hasData ? Number(point.load.toFixed(1)) : null,
      missing_duration_count: point.missing_duration_count,
      acute: hasData ? Number(acuteSeries[i].toFixed(1)) : null, chronic: hasData ? Number(chronicSeries[i].toFixed(1)) : null })),
    explainability: explanation + missing + estimates + unresolved + outside,
  };
}

export function buildLoadStatus(metrics) {
  if (!metrics || metrics.has_data === false || !Number.isFinite(metrics.form)) return { label: 'No training load data', tone: 'neutral' };
  if (metrics.form < -30) return { label: 'High strain', tone: 'red' };
  if (metrics.form < -10) return { label: 'Productive build', tone: 'green' };
  if (metrics.form > 15) return { label: 'Detraining risk', tone: 'yellow' };
  if (metrics.form > 5) return { label: 'Fresh', tone: 'green' };
  return { label: 'Balanced', tone: 'green' };
}
