import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyActivity } from '../lib/activityInsights.js';
import { computeActivityTrimp, detectLoadSpikes, ewmaSeries, getLoadMetrics } from '../lib/trainingLoad.js';

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

// ─── detectLoadSpikes ─────────────────────────────────────────────────────────

// Fixed clock: Wednesday 2026-07-08. Current week starts Mon 07-06; the last
// complete week is 06-29..07-05; its 4-week baseline is 06-01..06-28.
const SPIKE_TODAY = new Date('2026-07-08T15:00:00Z');

// 15:00Z keeps the local calendar date identical under both UTC and
// America/Denver, so week bucketing is TZ-stable in tests.
function weekOfRuns(mondayDate, { runs = 3, minutes = 60, avgHr = 140 } = {}) {
  const monday = new Date(`${mondayDate}T15:00:00Z`);
  return Array.from({ length: runs }).map((_, i) => {
    const d = new Date(monday.getTime() + i * 2 * 86400000);
    return { ...run({ minutes, avgHr }), start_date: d.toISOString() };
  });
}

const STEADY_BASELINE = [
  ...weekOfRuns('2026-06-01'),
  ...weekOfRuns('2026-06-08'),
  ...weekOfRuns('2026-06-15'),
  ...weekOfRuns('2026-06-22'),
];

test('a +35% week over a flat 4-week baseline is a high-severity spike', () => {
  const activities = [
    ...STEADY_BASELINE,
    ...weekOfRuns('2026-06-29', { minutes: 81 }), // TRIMP is linear in duration → exactly +35%
  ];
  const spike = detectLoadSpikes(activities, {}, [], { today: SPIKE_TODAY });
  assert.ok(spike, 'spike expected');
  assert.equal(spike.severity, 'high');
  assert.ok(Math.abs(spike.rampPct - 35) <= 1, `rampPct ${spike.rampPct} should be ~35`);
  assert.equal(spike.isCurrentWeek, false);
  assert.match(spike.narrative, /35% above/);
});

test('a +5% week produces no spike', () => {
  const activities = [
    ...STEADY_BASELINE,
    ...weekOfRuns('2026-06-29', { minutes: 63 }),
  ];
  assert.equal(detectLoadSpikes(activities, {}, [], { today: SPIKE_TODAY }), null);
});

test('fewer than 3 non-zero baseline weeks yields no spike', () => {
  const activities = [
    ...weekOfRuns('2026-06-15'),
    ...weekOfRuns('2026-06-22'),
    ...weekOfRuns('2026-06-29', { minutes: 120 }),
  ];
  assert.equal(detectLoadSpikes(activities, {}, [], { today: SPIKE_TODAY }), null);
});

test('recovery interventions in the spike week are counted and named', () => {
  const activities = [
    ...STEADY_BASELINE,
    ...weekOfRuns('2026-06-29', { minutes: 90 }),
  ];
  const interventions = [
    { intervention_type: 'Sauna - Recovery', date: '2026-07-01' },
    { intervention_type: 'Foam Rolling', date: '2026-07-03' },
    { intervention_type: 'Gut Training', date: '2026-07-02' }, // not recovery
    { intervention_type: 'Sauna - Recovery', date: '2026-06-10' }, // outside spike week
  ];
  const spike = detectLoadSpikes(activities, {}, interventions, { today: SPIKE_TODAY });
  assert.ok(spike);
  assert.equal(spike.recoveryCount, 2);
  assert.deepEqual(spike.recoveryTypes.sort(), ['Foam Rolling', 'Sauna - Recovery']);
  assert.match(spike.narrative, /2 recovery-focused entries/);
});

test('near-zero baseline (returning from a break) suppresses the card', () => {
  const activities = [
    ...weekOfRuns('2026-06-01', { runs: 1, minutes: 5 }),
    ...weekOfRuns('2026-06-08', { runs: 1, minutes: 5 }),
    ...weekOfRuns('2026-06-15', { runs: 1, minutes: 5 }),
    ...weekOfRuns('2026-06-22', { runs: 1, minutes: 5 }),
    ...weekOfRuns('2026-06-29', { minutes: 90 }),
  ];
  assert.equal(detectLoadSpikes(activities, {}, [], { today: SPIKE_TODAY }), null);
});

test('a partial current week already over threshold flags as this week', () => {
  const activities = [
    ...weekOfRuns('2026-06-08'),
    ...weekOfRuns('2026-06-15'),
    ...weekOfRuns('2026-06-22'),
    ...weekOfRuns('2026-06-29'),
    ...weekOfRuns('2026-07-06', { runs: 2, minutes: 150 }), // Mon+Wed of current week
  ];
  const spike = detectLoadSpikes(activities, {}, [], { today: SPIKE_TODAY });
  assert.ok(spike);
  assert.equal(spike.isCurrentWeek, true);
  assert.match(spike.narrative, /this week so far/);
});

test('activities without moving_time do not poison the weekly sums', () => {
  const activities = [
    ...STEADY_BASELINE,
    { sport_type: 'Run', distance: 10000, moving_time: null, start_date: '2026-06-30T15:00:00Z' },
    ...weekOfRuns('2026-06-29', { minutes: 81 }),
  ];
  const spike = detectLoadSpikes(activities, {}, [], { today: SPIKE_TODAY });
  assert.ok(spike);
  assert.ok(Number.isFinite(spike.weekLoad));
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
