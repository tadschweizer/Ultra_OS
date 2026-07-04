import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyActivity } from '../lib/activityInsights.js';
import { computeActivityTrimp, ewmaSeries, getLoadMetrics } from '../lib/trainingLoad.js';

const MILE_METERS = 1609.34;

function run({ name = 'Morning Run', miles = 6, minutes = 50, avgHr = null, elevationFt = 100 }) {
  return {
    name,
    sport_type: 'Run',
    distance: miles * MILE_METERS,
    moving_time: minutes * 60,
    average_heartrate: avgHr,
    total_elevation_gain: elevationFt / 3.28084,
  };
}

// Regression: with no HR zones configured, hr_zone_4_min used to default to 0
// so every run with any heart rate was classified as "Intervals".
test('easy run with HR but no configured zones is NOT classified as intervals', () => {
  const result = classifyActivity(run({ miles: 6, minutes: 55, avgHr: 142 }), {});
  assert.notEqual(result.label, 'Intervals');
  assert.equal(result.label, 'Easy / Aerobic');
});

test('run titled with interval language classifies as Intervals', () => {
  const result = classifyActivity(run({ name: 'Track intervals 6x800', miles: 6, minutes: 45, avgHr: 155 }), {});
  assert.equal(result.label, 'Intervals');
});

test('interval keyword does not fire on substrings', () => {
  const result = classifyActivity(run({ name: 'Sunset shakeout', miles: 4, minutes: 35, avgHr: 130 }), {});
  assert.equal(result.label, 'Easy / Aerobic');
});

test('high HR counts as intervals only when zone 4 is configured', () => {
  const settings = { hr_zone_2_max: 145, hr_zone_3_min: 146, hr_zone_4_min: 165 };
  assert.equal(classifyActivity(run({ miles: 5, minutes: 35, avgHr: 172 }), settings).label, 'Intervals');
  assert.equal(classifyActivity(run({ miles: 5, minutes: 45, avgHr: 138 }), settings).label, 'Easy / Aerobic');
});

test('zones derived from max/resting HR classify threshold runs', () => {
  // Karvonen with max 190 / rest 50: z3 floor ≈ 148, z4 floor ≈ 172.
  const settings = { max_hr: 190, resting_hr: 50 };
  const result = classifyActivity(run({ miles: 7, minutes: 48, avgHr: 160 }), settings);
  assert.equal(result.label, 'Threshold');
});

test('long runs are still detected by distance', () => {
  const result = classifyActivity(run({ miles: 16, minutes: 130, avgHr: 140 }), {});
  assert.equal(result.label, 'Long Run');
});

test('TRIMP scales with intensity and duration', () => {
  const settings = { resting_hr: 55, max_hr: 190 };
  const easy = computeActivityTrimp(run({ minutes: 60, avgHr: 125 }), settings);
  const hard = computeActivityTrimp(run({ minutes: 60, avgHr: 170 }), settings);
  const long = computeActivityTrimp(run({ minutes: 120, avgHr: 125 }), settings);
  assert.ok(hard > easy, 'higher HR must score more load');
  assert.ok(Math.abs(long - easy * 2) < 0.001, 'load is linear in duration at equal HR');
  assert.ok(computeActivityTrimp(run({ minutes: 60, avgHr: null }), settings) > 0, 'no-HR sessions still score');
});

test('perceived exertion separates intensity when HR is missing', () => {
  const hard = computeActivityTrimp({ moving_time: 3600, perceived_exertion: 9 }, {});
  const easy = computeActivityTrimp({ moving_time: 3600, perceived_exertion: 3 }, {});
  const unknown = computeActivityTrimp({ moving_time: 3600 }, {});
  assert.ok(hard > easy, 'RPE 9 must score more load than RPE 3 at equal duration');
  assert.ok(unknown > 0, 'sessions with neither HR nor RPE still score');
});

test('EWMA converges toward a constant load and weights recency', () => {
  const steady = ewmaSeries(Array(84).fill(100), 7);
  assert.ok(Math.abs(steady[steady.length - 1] - 100) < 1, 'ATL converges to steady daily load');

  const spikeRecent = ewmaSeries([...Array(80).fill(0), 100, 100, 100, 100], 7);
  const spikeOld = ewmaSeries([100, 100, 100, 100, ...Array(80).fill(0)], 7);
  assert.ok(
    spikeRecent[spikeRecent.length - 1] > spikeOld[spikeOld.length - 1],
    'recent work must count more than six-week-old work'
  );
});

test('getLoadMetrics reports negative form during a load spike', () => {
  const today = new Date();
  const activities = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return { ...run({ minutes: 90, avgHr: 155 }), start_date: d.toISOString() };
  });
  const metrics = getLoadMetrics(activities, {});
  assert.ok(metrics.acute > metrics.chronic, 'a fresh week of training spikes fatigue above fitness');
  assert.ok(metrics.form < 0, 'TSB is negative while building');
  assert.equal(metrics.dailyLoad.length, 84);
  assert.equal(metrics.acuteSeries.length, 84);
});
