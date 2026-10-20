import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionPoints, rangeStats, distanceSplits, hrDistribution, planComparison, peakEfforts, plannedTimeSegments } from '../lib/sessionAnalysis.js';
import { createSessionAnalysisHandler } from '../pages/api/session-analysis.js';

const streams = { time: { data: [0, 10, 30] }, distance: { data: [0, 100, 300] }, heartrate: { data: [100, 160, 180] }, watts: { data: [100, 200, 300] } };
test('irregular samples are time weighted and selection clips interval edges', () => {
  const points = sessionPoints(streams), all = rangeStats(points);
  assert.equal(all.hr, 140); assert.equal(all.distance, 300); assert.equal(all.pace, 100);
  assert.equal(rangeStats(points, 5, 20).hr, 140); assert.equal(rangeStats(points, 5, 20).distance, 150);
});
test('missing sensors, gaps, duplicate timestamps and zero power stay truthful', () => {
  const points = sessionPoints({ time: { data: [0, 0, 10, 80, 90] }, heartrate: { data: [null, 99, 140, '', 200] }, watts: { data: [0, 5, 0, 0, 9] } });
  assert.equal(points.length, 4); const s = rangeStats(points);
  assert.equal(s.hr, null); assert.equal(s.power, 0); assert.equal(s.observed, 20); assert.equal(s.distance, null);
});
test('distance splits interpolate boundaries and retain the final partial split', () => {
  const p = Array.from({ length: 26 }, (_, i) => ({ t: i * 10, distance: i * 100, hr: 120 }));
  const rows = distanceSplits(p); assert.deepEqual(rows.map(s => s.duration), [100, 100, 50]);
  assert.equal(rows[2].distance, 500); assert.match(rows[2].label, /partial/);
  assert.ok(Math.abs(distanceSplits(p, 1609.344)[0].duration - 160.9344) < 0.001);
  p[4].distance = null; assert.deepEqual(distanceSplits(p), []);
});
test('zones require configured ordered thresholds and use observed seconds', () => {
  assert.equal(hrDistribution(sessionPoints(streams)), null);
  const bins = hrDistribution(sessionPoints(streams), { hr_zone_2_max: 130, hr_zone_3_min: 140, hr_zone_4_min: 160 });
  assert.deepEqual(bins.map(b => b.seconds), [10, 0, 0, 20]);
});
test('manual comparisons preserve missing and zero actuals without assuming success', () => {
  const result = planComparison({ planned_duration_min: 40, completed_duration_min: 0, planned_distance_km: 5 });
  assert.equal(result[0].delta, -40); assert.equal(result[1].actual, null); assert.equal(result[1].delta, null);
  assert.deepEqual(planComparison(null), []);
});
test('peak windows include exact partial final samples and reject gaps', () => {
  const p = sessionPoints(streams);
  const peak = peakEfforts(p, 'power', [15])[0];
  assert.equal(peak.average, 200); assert.equal(peak.start, 10); assert.equal(peak.end, 25);
  p[1].power = null; assert.deepEqual(peakEfforts(p, 'power', [15]), []);
});
test('planned time segments truncate to the recording and reject ambiguous repeats', () => {
  const p = sessionPoints(streams);
  assert.equal(plannedTimeSegments({ structure: [{ duration_min: 1 }] }, p)[0].end, 30);
  assert.deepEqual(plannedTimeSegments({ structure: [{ duration_min: 1, repeat: 2 }] }, p), []);
});

function fixture({ caller = 'athlete', related = true, privatePlan = false, mismatch = false, manual = false, enabled = true, fail = false } = {}) {
  const calls = [];
  const rows = { planned_workouts: { id: 'workout', athlete_id: 'athlete', coach_id: 'coach', visibility: privatePlan ? 'coach_private' : 'athlete_visible', status: 'completed', completed_activity_id: manual ? null : 'activity' },
    strava_activities: { id: 'activity', athlete_id: mismatch ? 'other' : 'athlete', strava_activity_id: '123', source: 'strava', moving_time: 30, distance: 300, raw_payload: { secret: 'never send' } },
    athletes: { id: 'athlete', access_token: 'secret' }, athlete_settings: {} };
  const admin = { from(table) { const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { calls.push(table); return { data: rows[table] }; } }; return q; } };
  const handler = createSessionAnalysisHandler({ getAdmin: () => admin, resolveAthlete: async () => caller,
    accountAccess: async () => ({ capabilities: { coach: caller === 'coach' }, coachProfile: { id: 'coach' } }), relationship: async () => related,
    tokenFor: async () => { calls.push('token'); return 'secret'; }, providerEnabled: () => enabled,
    streamsFor: async () => { calls.push('streams'); if (fail) throw Error('private error'); return streams; },
    detailsFor: async () => ({ laps: [{ start_index: 0, end_index: 2 }], secret: 'never send' }) });
  return { calls, async run(query = { activity_id: 'activity' }, method = 'GET') { const res = { code: 200, setHeader() {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } }; await handler({ method, query }, res); return res; } };
}
test('owner and active coach receive sanitized recordings for assigned and unassigned sessions', async () => {
  for (const caller of ['athlete', 'coach']) for (const query of [{ activity_id: 'activity' }, { workout_id: 'workout' }]) {
    const res = await fixture({ caller }).run(query); assert.equal(res.code, 200); assert.equal(res.body.points.length, 3); assert.equal(res.body.laps.length, 1); assert.equal(JSON.stringify(res.body).includes('secret'), false);
  }
});
test('anonymous, unrelated, revoked and private-workout readers cannot reach provider', async () => {
  for (const config of [{ caller: null }, { caller: 'outsider' }, { caller: 'coach', related: false }, { privatePlan: true }]) {
    const f = fixture(config), res = await f.run({ workout_id: 'workout' }); assert.ok([401, 403].includes(res.code)); assert.ok(!f.calls.includes('token'));
  }
});
test('cross-owner links fail closed and unsupported methods do not read records', async () => {
  const f = fixture({ mismatch: true }); assert.equal((await f.run({ workout_id: 'workout' })).code, 403); assert.ok(!f.calls.includes('token'));
  const post = fixture(); assert.equal((await post.run({}, 'POST')).code, 405); assert.equal(post.calls.length, 0);
});
test('manual, disabled-provider and failed streams retain explicit missing-data states', async () => {
  for (const config of [{ manual: true }, { enabled: false }, { fail: true }]) {
    const f = fixture(config), res = await f.run({ workout_id: 'workout' }); assert.equal(res.code, 200); assert.deepEqual(res.body.points, []); assert.ok(res.body.recording);
    if (!config.fail) assert.ok(!f.calls.includes('streams'));
  }
});
