import { metersToFeet, metersToMiles, secondsToHours } from './activityInsights.js';
import { activityDateKey } from './workoutCompliance.js';

/**
 * Weekly volume rollups (distance, time, elevation, longest session) for the
 * Athlete Core trend charts. Weeks start on Monday. Activities are bucketed by
 * the athlete's recorded local day (local_date / start_date_local), so a late
 * session stays in its own week wherever the viewer is.
 */

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function weekStartOf(dateLike) {
  if (!dateLike) return null;
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

// Parses the activity's local calendar day as a local-midnight Date.
function localDayOf(activity) {
  const key = activityDateKey(activity);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function emptyWeek(start) {
  return {
    weekStart: localDateKey(start),
    label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    miles: 0,
    hours: 0,
    elevationFt: 0,
    count: 0,
    longestMiles: 0,
  };
}

export function buildVolumeTrend(activities = [], { weeks = 12, now = new Date() } = {}) {
  const currentStart = weekStartOf(now);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(currentStart);
    start.setDate(currentStart.getDate() - i * 7);
    buckets.push(emptyWeek(start));
  }
  const byKey = new Map(buckets.map((week) => [week.weekStart, week]));

  for (const activity of activities || []) {
    const start = weekStartOf(localDayOf(activity));
    if (!start) continue;
    const week = byKey.get(localDateKey(start));
    if (!week) continue;
    const miles = metersToMiles(Number(activity.distance) || 0);
    week.miles += miles;
    week.hours += secondsToHours(Number(activity.moving_time) || 0);
    week.elevationFt += metersToFeet(Number(activity.total_elevation_gain) || 0);
    week.count += 1;
    week.longestMiles = Math.max(week.longestMiles, miles);
  }

  return buckets.map((week) => ({
    ...week,
    miles: round(week.miles, 1),
    hours: round(week.hours, 1),
    elevationFt: Math.round(week.elevationFt),
    longestMiles: round(week.longestMiles, 1),
  }));
}

/**
 * Compares the last four complete weeks with the four before them. The
 * in-progress current week is excluded so a Monday never reads as a collapse.
 */
export function compareVolumeBlocks(trend = []) {
  const complete = trend.slice(0, -1);
  const recent = complete.slice(-4);
  const prior = complete.slice(-8, -4);
  const metrics = ['miles', 'hours', 'elevationFt'];
  return Object.fromEntries(metrics.map((metric) => {
    const recentAvg = average(recent.map((week) => week[metric]));
    const priorAvg = average(prior.map((week) => week[metric]));
    const changePct = prior.length === 4 && priorAvg > 0
      ? Math.round(((recentAvg - priorAvg) / priorAvg) * 100)
      : null;
    return [metric, { recentAvg: round(recentAvg, 1), priorAvg: round(priorAvg, 1), changePct }];
  }));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
