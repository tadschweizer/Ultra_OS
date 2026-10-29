import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planFixture, owner, other, coach, plan } from './helpers/plan-prescription-fixture.mjs';
import { canMoveCalendarWorkout } from '../lib/calendarTransfer.js';

const activity = '55555555-5555-4555-8555-555555555555';
const replacement = '66666666-6666-4666-8666-666666666666';
const secondPlan = '44444444-4444-4444-8444-444444444444';
const foreign = '77777777-7777-4777-8777-777777777777';
const migration = readFileSync(new URL('../supabase/migrations/20261029150644_calendar_move_and_coach_matches.sql', import.meta.url), 'utf8');
async function fixture() {
  const f = await planFixture();
  await f.pg.exec('reset role; alter table coach_athlete_relationships add column removed_at timestamptz, add column expires_at timestamptz;');
  await f.pg.exec(migration);
  await f.pg.exec('set role service_role;');
  const move = async (date, actor = owner, expected) => f.invoke({ id: plan, action: 'move', workout_date: date,
    expected_updated_at: expected || (await f.row()).updated_at.toISOString() }, { actor });
  const match = async (actor = other, id = activity, expected) => f.invoke({ id: plan, match_action: 'confirm', activity_id: id,
    expected_updated_at: expected || (await f.row()).updated_at.toISOString() }, { actor });
  return { ...f, move, match };
}

test('signed API + PostgreSQL: athlete and assigning coach move unfinished plans; notes, targets and retry identity survive', async () => {
  const f = await fixture(); try {
    const version = (await f.row()).updated_at.toISOString();
    const first = await f.move('2026-10-05');
    assert.equal(first.code, 200, JSON.stringify(first.body));
    const moved = await f.row();
    assert.equal(moved.workout_date.toISOString().slice(0,10), '2026-10-05');
    assert.equal(Number(moved.planned_duration_min), 60);
    assert.equal(moved.athlete_comment, 'Keep my note');
    assert.equal(moved.coach_feedback, 'Keep coach feedback');
    assert.equal(moved.activity_match_mode, 'manual');
    assert.equal((await f.move('2026-10-05', owner, version)).code, 200);
    assert.equal((await f.row()).updated_at.toISOString(), moved.updated_at.toISOString());
    assert.equal((await f.move('2026-10-06', owner, version)).code, 409);
    assert.equal((await f.move('2026-10-04', other)).code, 200);
    assert.equal((await f.move('2026-02-30')).code, 400);
    assert.equal((await f.move('2026-10-07', null)).code, 401);
  } finally { await f.close(); }
});

test('signed API + PostgreSQL: coach confirms/replays/replaces a same-athlete match with the actual coach actor', async () => {
  const f = await fixture(); try {
    const version = (await f.row()).updated_at.toISOString();
    const result = await f.match(); assert.equal(result.code,200,JSON.stringify(result.body));
    assert.equal(result.body.workout.completed_activity_id, activity);
    assert.equal(result.body.workout.completed_duration_min,30);
    assert.equal(result.body.workout.athlete_comment,'Keep my note');
    assert.equal((await f.match(other,activity,version)).code,200);
    const corrected = await f.match(other,replacement);
    assert.equal(corrected.code,200);
    assert.equal(corrected.body.workout.completed_duration_min,40);
    assert.equal(corrected.body.workout.completed_distance_km,0);
    assert.equal((await f.invoke({id:secondPlan,match_action:'confirm',activity_id:replacement,
      expected_updated_at:(await f.row(secondPlan)).updated_at.toISOString()},{actor:other})).code,409);
    assert.equal((await f.match(other,foreign)).code,400);
    assert.equal((await f.move('2026-10-08')).code,409);
    assert.equal((await f.move('2026-10-04')).code,409);
    await f.pg.query("update coach_athlete_relationships set status='removed' where coach_id=$1",[coach]);
    assert.equal((await f.match()).code,403);
    assert.equal((await f.move('2026-10-09',other)).code,403);
    // The athlete retains their own authority after the relationship ends.
    assert.equal((await f.match(owner,replacement)).code,200);
  } finally { await f.close(); }
});

test('PostgreSQL enforces visibility, active/unexpired relationship, assigning coach movement and service-only execution', async () => {
  const f = await fixture(); try {
    await f.pg.exec("update coach_athlete_relationships set expires_at=now()-interval '1 day'");
    assert.equal((await f.match()).code,403);
    await f.pg.exec("update coach_athlete_relationships set expires_at=null,removed_at=now()");
    assert.equal((await f.match()).code,403);
    await f.pg.exec("update coach_athlete_relationships set removed_at=null; update planned_workouts set visibility='coach_private'");
    assert.equal((await f.match(owner)).code,404);
    assert.equal((await f.match()).code,200);
    await f.pg.exec("update planned_workouts set status='planned',completed_activity_id=null,visibility='athlete_visible',coach_id=null");
    assert.equal((await f.move('2026-10-08',other)).code,403);
    assert.equal((await f.match()).code,200); // Active coach can match a visible self-plan.
    await f.pg.exec('reset role');
    for (const role of ['anon','authenticated']) for (const fn of ['move_calendar_workout(uuid,uuid,date,timestamptz)','authorize_calendar_workout(uuid,uuid,boolean)','decide_workout_activity_match(uuid,uuid,text,uuid,timestamptz)']) {
      assert.equal((await f.pg.query('select has_function_privilege($1,$2,\'execute\') as allowed',[role,`public.${fn}`])).rows[0].allowed,false);
    }
  } finally { await f.close(); }
});

test('calendar movement affordance excludes recorded/skipped sessions and other coaches prescriptions', () => {
  const workout = {status:'planned',coach_id:coach};
  assert.equal(canMoveCalendarWorkout(workout,'athlete'),true);
  assert.equal(canMoveCalendarWorkout(workout,'coach',coach),true);
  assert.equal(Boolean(canMoveCalendarWorkout(workout,'coach','different')),false);
  assert.equal(canMoveCalendarWorkout({...workout,status:'completed'},'athlete'),false);
  assert.equal(canMoveCalendarWorkout({...workout,status:'completed',activity_match_state:'suggested'},'athlete'),true);
  assert.equal(canMoveCalendarWorkout({...workout,completed_activity_id:activity},'athlete'),false);
  assert.equal(canMoveCalendarWorkout({...workout,status:'skipped'},'athlete'),false);
});
