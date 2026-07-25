import test from 'node:test';
import assert from 'node:assert/strict';

import { toActivityRow } from '../lib/activitySync.js';
import { estimateTssFromActivity } from '../lib/trainingLoad.js';

const ATHLETE_ID = '11111111-1111-4111-8111-111111111111';
const MILE_METERS = 1609.34;

function stravaActivity(overrides = {}) {
  return {
    id: 987654321,
    name: 'Morning Run',
    type: 'Run',
    sport_type: 'Run',
    start_date: '2026-07-24T01:30:00Z',
    start_date_local: '2026-07-23T19:30:00Z',
    utc_offset: -21600,
    timezone: '(GMT-07:00) America/Denver',
    distance: 11.1 * MILE_METERS,
    moving_time: 5482,
    elapsed_time: 5600,
    total_elevation_gain: 420,
    average_heartrate: 148,
    max_heartrate: 171,
    kilojoules: 1180,
    ...overrides,
  };
}

// The bug this guards: start_date is a UTC instant, so a 19:30 MDT run is
// 01:30 UTC the *next* day. Bucketing the calendar on the UTC day pushed every
// evening session one square to the right.
test('an evening session is stored on the athlete local day, not the UTC day', () => {
  const row = toActivityRow(ATHLETE_ID, stravaActivity());

  assert.equal(row.local_date, '2026-07-23');
  assert.equal(row.start_date_local, '2026-07-23T19:30:00');
  assert.notEqual(row.local_date, row.start_date.slice(0, 10));
});

test('local day falls back to the UTC offset when Strava omits the local start', () => {
  const row = toActivityRow(ATHLETE_ID, stravaActivity({ start_date_local: undefined }));

  assert.equal(row.local_date, '2026-07-23');
});

test('local day is null when the activity carries no usable timestamp', () => {
  const row = toActivityRow(ATHLETE_ID, stravaActivity({ start_date_local: undefined, start_date: null }));

  assert.equal(row.local_date, null);
  assert.equal(row.start_date_local, null);
});

test('the upsert key is the athlete plus the provider id as text', () => {
  const row = toActivityRow(ATHLETE_ID, stravaActivity());

  assert.equal(row.athlete_id, ATHLETE_ID);
  assert.equal(row.strava_activity_id, '987654321');
  assert.equal(typeof row.strava_activity_id, 'string');
});

test('week-rail fields survive the mapping', () => {
  const row = toActivityRow(ATHLETE_ID, stravaActivity());

  assert.equal(row.moving_time, 5482);
  assert.equal(row.total_elevation_gain, 420);
  assert.equal(row.kilojoules, 1180);
  assert.equal(row.average_heartrate, 148);
  assert.ok(row.tss > 0, 'load should be scored at import time');
  assert.equal(row.source, 'strava');
});

test('missing numeric fields become null rather than NaN', () => {
  const row = toActivityRow(ATHLETE_ID, stravaActivity({
    distance: undefined,
    average_heartrate: null,
    kilojoules: 'not-a-number',
  }));

  assert.equal(row.distance, null);
  assert.equal(row.average_heartrate, null);
  assert.equal(row.kilojoules, null);
});

test('load scoring rates a hard session above easy volume of the same length', () => {
  const easy = estimateTssFromActivity({ movingTimeSec: 3600, averageHeartrate: 120 });
  const hard = estimateTssFromActivity({ movingTimeSec: 3600, averageHeartrate: 172 });

  assert.ok(hard.tss > easy.tss);
  assert.ok(hard.intensityFactor > easy.intensityFactor);
});

test('a zero-duration activity scores no load instead of dividing by zero', () => {
  const result = estimateTssFromActivity({ movingTimeSec: 0, averageHeartrate: 150 });

  assert.equal(result.tss, null);
  assert.equal(result.intensityFactor, null);
});

test('an activity without heart rate still scores on duration', () => {
  const result = estimateTssFromActivity({ movingTimeSec: 3600, averageHeartrate: null });

  assert.ok(result.tss > 0);
  assert.equal(result.intensityFactor, 0.5);
});

// Stored rows carry local_date; the compliance layer must key off it rather
// than the UTC instant, or an evening session lands on the following day.
test('compliance keys an activity on its local day, not the UTC day', async () => {
  const { activityDateKey } = await import('../lib/workoutCompliance.js');

  assert.equal(
    activityDateKey({ local_date: '2026-07-23', start_date: '2026-07-24T01:30:00Z' }),
    '2026-07-23'
  );
  assert.equal(
    activityDateKey({ start_date_local: '2026-07-23T19:30:00', start_date: '2026-07-24T01:30:00Z' }),
    '2026-07-23'
  );
  // Legacy rows with neither still resolve to something usable.
  assert.equal(activityDateKey({ start_date: '2026-07-24T01:30:00Z' }), '2026-07-24');
  assert.equal(activityDateKey(null), null);
});

test('an unplanned evening activity matches a plan on the day it was actually run', async () => {
  const { matchActivitiesToWorkouts } = await import('../lib/workoutCompliance.js');

  const workouts = [{ id: 'w1', workout_date: '2026-07-23', sport: 'run', planned_duration_min: 90 }];
  const activities = [{
    id: 42,
    sport_type: 'Run',
    moving_time: 5460,
    local_date: '2026-07-23',
    start_date: '2026-07-24T01:30:00Z',
  }];

  const matched = matchActivitiesToWorkouts(workouts, activities, { toleranceDays: 0 });
  assert.equal(matched.get('w1')?.id, 42);
});
