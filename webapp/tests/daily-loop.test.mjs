import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkoutFields } from '../lib/workoutValidation.js';
import { calendarMutation } from '../lib/calendarMutation.js';
import { decorateWorkoutsWithCompliance } from '../lib/workoutCompliance.js';
import { insertMessageOnce, loadMessagePage, parseMessageCursor } from '../lib/directMessages.js';
import { mergeMessages } from '../lib/messageClient.js';

test('completion accepts partial actuals and rejects invalid scores, negative values and impossible dates', () => {
  assert.equal(validateWorkoutFields({ status: 'completed', completed_duration_min: 15, completed_distance_km: null, athlete_rpe: 7 }), null);
  for (const bad of [{ completed_duration_min: -2 }, { completed_distance_km: Infinity }, { athlete_rpe: 11 }, { athlete_rpe: 1.5 }, { workout_date: '2026-02-30' }, { title: ' ' }]) assert.ok(validateWorkoutFields(bad));
  assert.equal(validateWorkoutFields({ status: 'planned', completed_duration_min: null, athlete_rpe: null }), null);
});

test('later imports cannot fill unknown manual actuals or consume an explicitly linked activity twice', () => {
  const activity = { id: 'activity', local_date: '2026-10-04', sport_type: 'Run', moving_time: 3600, distance: 10000 };
  const manual = { id: 'manual', workout_date: '2026-10-04', sport: 'run', status: 'completed', completed_duration_min: 20, completed_distance_km: null };
  const [result] = decorateWorkoutsWithCompliance([manual], [activity]);
  assert.equal(result.completed_duration_min, 20); assert.equal(result.completed_distance_km, null); assert.equal(result.matched_activity, null);
  const linked = { ...manual, completed_activity_id: 'activity' };
  const plan = { ...manual, id: 'plan', status: 'planned', completed_duration_min: null };
  assert.equal(decorateWorkoutsWithCompliance([linked, plan], [activity])[1].status, 'planned');
});

test('calendar failures resolve with actionable errors and success preserves the returned record', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('offline'); });
  assert.match((await calendarMutation('/api/planned-workouts')).error, /Connection lost/);
  globalThis.fetch = async () => new Response('bad proxy', { status: 502 });
  assert.equal((await calendarMutation('/api/planned-workouts')).ok, false);
  globalThis.fetch = async () => Response.json({ workout: { id: 'persisted' } });
  assert.equal((await calendarMutation('/api/planned-workouts')).workout.id, 'persisted');
});

const id = '11111111-1111-4111-8111-111111111111';
test('message cursor rejects filter injection and supports timestamp ties', () => {
  assert.equal(parseMessageCursor(`2026-10-04T12:00:00.123456+00:00|${id}`).id, id);
  for (const value of ['x', `now,or(id.gt.0)|${id}`, `2026-10-04T12:00:00Z|anything`, []]) assert.throws(() => parseMessageCursor(value));
});

test('message retries return the original only for the same conversation, role and body', async () => {
  const payload = { coach_id: 'coach', athlete_id: 'athlete', sender_role: 'athlete', message_body: 'Hello' };
  const rows = new Map();
  const admin = { from() {
    let insert, filters = {};
    return { insert(value) { insert = value; return this; }, select() { return this; }, eq(k,v) { filters[k]=v; return this; },
      async single() { if (rows.has(insert.id)) return { error: { code: '23505' } }; rows.set(insert.id, insert); return { data: insert }; },
      async maybeSingle() { return { data: [...rows.values()].find(row => Object.entries(filters).every(([k,v]) => row[k]===v)) || null }; } };
  } };
  assert.equal((await insertMessageOnce(admin, payload, id)).data.id, id);
  assert.equal((await insertMessageOnce(admin, payload, id)).replayed, true);
  assert.ok((await insertMessageOnce(admin, { ...payload, athlete_id: 'other' }, id)).error);
  assert.ok((await insertMessageOnce(admin, { ...payload, message_body: 'Changed' }, id)).error);
  assert.equal(rows.size, 1);
});

test('message pages are bounded, ordered chronologically and carry a stable next cursor', async () => {
  const rows = Array.from({ length: 51 }, (_, n) => ({ id: String(100-n), created_at: '2026-10-04T12:00:00Z' }));
  let limit;
  const admin = { from() { return { select(){return this;}, eq(){return this;}, order(){return this;}, limit(n){limit=n;return this;}, then(resolve){return Promise.resolve({data:rows}).then(resolve);} }; } };
  const page = await loadMessagePage(admin, 'coach', 'athlete');
  assert.equal(limit, 51); assert.equal(page.messages.length, 50);
  assert.equal(page.messages[0].id, '51'); assert.equal(page.next_cursor, '2026-10-04T12:00:00Z|51');
});

test('history refresh retains older messages and deduplicates new replies', () => {
  const first = { id:'a', created_at:'2026-10-01', message_body:'first' };
  const second = { id:'b', created_at:'2026-10-02', message_body:'second' };
  assert.deepEqual(mergeMessages([first,second], [{...second,read_at:'now'}]).map(m=>m.id), ['a','b']);
});
