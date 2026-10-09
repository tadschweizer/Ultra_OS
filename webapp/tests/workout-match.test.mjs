import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { decorateWorkoutsWithCompliance } from '../lib/workoutCompliance.js';
import { decideWorkoutMatch } from '../lib/workoutMatch.js';
import { createPlannedWorkoutsHandler } from '../pages/api/planned-workouts.js';
import { resolveEffectiveAthleteId } from '../lib/auth/requireAthlete.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';

process.env.SESSION_COOKIE_SECRET = 'local-workout-match-tests-secret-32-characters';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const plan = '33333333-3333-4333-8333-333333333333';
const secondPlan = '44444444-4444-4444-8444-444444444444';
const activity = '55555555-5555-4555-8555-555555555555';
const replacement = '66666666-6666-4666-8666-666666666666';
const foreign = '77777777-7777-4777-8777-777777777777';
const coach = '88888888-8888-4888-8888-888888888888';
const migration = readFileSync(new URL('../supabase/migrations/20261007162647_workout_match_decisions.sql', import.meta.url), 'utf8');
const source = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

// A small PostgREST-shaped adapter executes actual SQL in isolated PostgreSQL.
// No provider traffic, network, production credentials or hosted writes.
function client(pg) {
  return {
    async rpc(name, args) {
      assert.equal(name, 'decide_workout_activity_match');
      try { return { data: (await pg.query('select public.decide_workout_activity_match($1,$2,$3,$4,$5) as value', Object.values(args))).rows[0].value }; }
      catch (error) { return { error }; }
    },
    from(table) {
      assert.ok(/^[a-z_]+$/.test(table));
      let columns = '*', patch, payload, single = false;
      const filters = [], values = [], orders = [];
      const predicate = (column, operator, value) => { assert.ok(/^[a-z_]+$/.test(column)); values.push(value); filters.push(`${column} ${operator} $${values.length}`); };
      const query = {
        select(value = '*') { columns = value; return this; },
        eq(k,v) { predicate(k,'=',v); return this; },
        gte(k,v) { predicate(k,'>=',v); return this; },
        lte(k,v) { predicate(k,'<=',v); return this; },
        in(k,v) { assert.ok(/^[a-z_]+$/.test(k)); values.push(v); filters.push(`${k}::text = any($${values.length}::text[])`);
          if(k==='completed_activity_id') assert.ok(v.length<=100); return this; },
        not(k,op,v) { assert.equal(op,'is'); assert.equal(v,null); filters.push(`${k} is not null`); return this; },
        order(k,{ascending}={}) { orders.push(`${k} ${ascending ? 'asc' : 'desc'}`); return this; },
        update(value) { patch = value; return this; },
        insert(value) { payload = value; return this; },
        maybeSingle() { single = true; return this; },
        single() { single = true; return this; },
        async then(resolve, reject) {
          try {
            const where = filters.length ? ` where ${filters.join(' and ')}` : '';
            let sql;
            if (patch) {
              const assignments = Object.entries(patch).map(([k,v]) => { values.push(v); return `${k} = $${values.length}`; });
              sql = `update ${table} set ${assignments.join(',')} ${where} returning ${columns}`;
            } else if (payload) {
              const keys = Object.keys(payload);
              values.push(...Object.values(payload));
              sql = `insert into ${table} (${keys.join(',')}) values (${keys.map((_,i)=>`$${i+1}`).join(',')}) returning ${columns}`;
            } else sql = `select ${columns} from ${table}${where}${orders.length ? ` order by ${orders.join(',')}` : ''}`;
            const rows = JSON.parse(JSON.stringify((await pg.query(sql, values)).rows));
            return resolve({ data: single ? rows[0] || null : rows });
          } catch (error) { return resolve({ error }); }
        },
      };
      return query;
    },
  };
}

async function fixture({ stravaConnected = true } = {}) {
  const pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table athletes(id uuid primary key, supabase_user_id uuid, session_version integer default 1, is_admin boolean default false);
    create table athlete_settings(athlete_id uuid primary key);
    create table coach_profiles(id uuid primary key, athlete_id uuid);
    create function public.is_current_athlete(uuid) returns boolean language sql as 'select false';`);
  await pg.exec(source('20260611120000_add_training_calendar.sql'));
  await pg.exec(source('20260617120000_trainingpeaks_parity_foundation.sql').split('CREATE TABLE IF NOT EXISTS public.workout_comments')[0]);
  await pg.exec(source('20260721120000_workout_units_and_targets.sql'));
  await pg.exec(source('20260725000000_activity_sync_persistence.sql'));
  await pg.exec(`create table workout_comments(planned_workout_id uuid, activity_id text);
    insert into athletes(id) values('${owner}'),('${other}');
    insert into coach_profiles values('${coach}','${other}');
    insert into planned_workouts(id,athlete_id,coach_id,workout_date,title,planned_duration_min,athlete_comment,athlete_rpe,coach_feedback)
      values('${plan}','${owner}','${coach}','2026-10-04','Easy run',60,'Keep my note',7,'Keep coach feedback'),
      ('${secondPlan}','${owner}',null,'2026-10-04','Second run',30,null,null,null);
    insert into strava_activities(id,athlete_id,strava_activity_id,name,sport_type,local_date,start_date,moving_time,distance)
      values('${activity}','${owner}','101','Evening run','Run','2026-10-04','2026-10-05T01:00:00Z',1800,5000),
      ('${replacement}','${owner}','102','Replacement run','Run','2026-10-05','2026-10-05T12:00:00Z',2400,0),
      ('${foreign}','${other}','103','Foreign run','Run','2026-10-04','2026-10-04T12:00:00Z',3600,10000);`);
  await pg.exec(migration);
  await pg.exec('grant usage on schema public to service_role; grant select,insert,update,delete on all tables in schema public to service_role; set role service_role;');
  const admin = client(pg);
  const handler = createPlannedWorkoutsHandler({ getAdmin: () => admin,
    resolveAthlete: async req => (await resolveEffectiveAthleteId(req, admin)).athleteId,
    fetchActivities: async (_admin, actor, start, end) => ({
      activities: JSON.parse(JSON.stringify((await pg.query('select * from strava_activities where athlete_id=$1 and local_date between $2 and $3',[actor,start,end])).rows)),
      stravaConnected,
    }),
  });
  const row = async (id = plan) => (await pg.query('select * from planned_workouts where id=$1',[id])).rows[0];
  async function invoke(body = {}, { actor = owner, method = 'PATCH', query = {} } = {}) {
    const req = { method, body, query, headers: { cookie: actor ? `athlete_id=${signAthleteSession(actor)}` : '' } };
    const res = { code: 200, status(c) { this.code=c; return this; }, json(b) { this.body=b; return this; } };
    await handler(req,res); return res;
  }
  const decision = async (action, id = activity, workout = plan) => invoke({ id: workout, match_action: action, activity_id: id, expected_updated_at: (await row(workout)).updated_at.toISOString() });
  return { pg, admin, handler, row, invoke, decision };
}

test('saved rejection survives new imports; confirmed links preserve manual actuals and local dates', () => {
  const w = { id: plan, status:'planned', sport:'run', workout_date:'2026-10-04', activity_match_mode:'manual' };
  const a = { id:activity, local_date:'2026-10-04', start_date:'2026-10-05', moving_time:1800 };
  assert.equal(decorateWorkoutsWithCompliance([w],[a])[0].status,'planned');
  const confirmed = decorateWorkoutsWithCompliance([{ ...w,status:'completed',completed_activity_id:activity,completed_duration_min:20 }],[a])[0];
  assert.equal(confirmed.completed_duration_min,20); assert.equal(confirmed.display_date,'2026-10-04');
  assert.equal(confirmed.activity_match_state,'confirmed');
  assert.equal(decorateWorkoutsWithCompliance([{ ...w,status:'completed',completed_activity_id:activity,completed_duration_min:20 }],[])[0].activity_match_state,'unavailable');
});

test('signed handler + PostgreSQL: confirm, replay, replace, unlink, rejection and restore persist', async () => {
  const f = await fixture(); try {
    const preflight=readFileSync(new URL('../scripts/workout-match-schema-preflight.sql',import.meta.url),'utf8');
    assert.equal((await f.pg.query(preflight)).rows[0].workout_match_readiness.ready,true);
    const first = await f.decision('confirm'); assert.equal(first.code,200,JSON.stringify(first.body));
    assert.equal(first.body.workout.completed_duration_min,30);
    const stale = { id:plan,match_action:'confirm',activity_id:activity,expected_updated_at:'2000-01-01T00:00:00Z' };
    assert.equal((await f.invoke(stale)).body.workout.updated_at,first.body.workout.updated_at);
    const replaced = await f.decision('confirm',replacement); assert.equal(replaced.code,200);
    assert.equal(replaced.body.workout.completed_distance_km,0); assert.equal(replaced.body.workout.completed_duration_min,40);
    assert.equal(replaced.body.workout.athlete_comment,'Keep my note'); assert.equal(replaced.body.workout.athlete_rpe,7);
    assert.equal(replaced.body.workout.coach_feedback,'Keep coach feedback');
    assert.equal((await f.decision('reject')).code,200);
    let saved = await f.row(); assert.equal(saved.status,'planned'); assert.equal(saved.activity_match_mode,'manual'); assert.equal(saved.completed_duration_min,null);
    assert.equal((await f.invoke({}, {method:'GET',query:{start:'2026-10-04',end:'2026-10-05'}})).body.workouts.find(w=>w.id===plan).status,'planned');
    assert.equal((await f.decision('auto')).code,200); saved = await f.row(); assert.equal(saved.activity_match_mode,'auto');
  } finally { await f.pg.close(); }
});

test('signed handler + PostgreSQL: ownership, session revocation, stale edits and raw link bypass fail closed', async () => {
  const f = await fixture(); try {
    assert.equal((await f.invoke({id:plan,match_action:'confirm',activity_id:activity,expected_updated_at:'2026-01-01T00:00:00Z'},{actor:null})).code,401);
    assert.equal((await f.decision('confirm',foreign)).code,400);
    assert.equal((await f.invoke({id:plan,match_action:'reject'},{actor:other})).code,403);
    assert.equal((await f.invoke({id:plan,completed_activity_id:foreign})).code,400);
    assert.equal((await f.invoke({id:plan,activity_match_mode:'auto'})).code,400);
    assert.equal((await f.invoke({id:plan,match_action:'confirm',activity_id:activity,expected_updated_at:'2020-01-01T00:00:00Z'})).code,409);
    assert.equal((await f.invoke({id:plan,status:'completed',completed_duration_min:15,expected_updated_at:'2020-01-01T00:00:00Z'})).code,409);
    await f.pg.exec('reset role;');
    for (const role of ['anon','authenticated']) {
      assert.equal((await f.pg.query("select has_function_privilege($1, 'public.decide_workout_activity_match(uuid,uuid,text,uuid,timestamptz)', 'execute') as allowed",[role])).rows[0].allowed,false);
      await f.pg.exec(`set role ${role}`);
      await assert.rejects(f.pg.query('select public.decide_workout_activity_match($1,$2,$3,$4,$5)',[owner,plan,'confirm',activity,'2020-01-01']),/permission denied/);
      await f.pg.exec('reset role');
    }
    await f.pg.exec('set role service_role; update athletes set session_version=2;');
    assert.equal((await f.decision('confirm')).code,401);
  } finally { await f.pg.close(); }
});

test('PostgreSQL: duplicate link is refused, manual corrections release it, and old suggestions cannot overwrite them', async () => {
  const f = await fixture(); try {
    const version = (await f.row()).updated_at.toISOString();
    assert.equal((await f.decision('confirm')).code,200);
    assert.equal((await f.decision('confirm',activity,secondPlan)).code,409);
    const manual = await f.invoke({id:plan,status:'completed',completed_duration_min:12,completed_distance_km:null});
    assert.equal(manual.code,200); assert.equal(manual.body.workout.completed_activity_id,null); assert.equal(manual.body.workout.activity_match_mode,'manual');
    assert.equal((await f.invoke({id:plan,match_action:'confirm',activity_id:replacement,expected_updated_at:version})).code,409);
    assert.equal((await f.decision('confirm',activity,secondPlan)).code,200);
    const undone = await f.invoke({id:plan,status:'planned'}); assert.equal(undone.code,200); assert.equal(undone.body.workout.completed_duration_min,null);
  } finally { await f.pg.close(); }
});

test('calendar GET reserves confirmed activities from plans outside the range and loads out-of-range links', async () => {
  const f = await fixture(); try {
    await f.decision('confirm');
    await f.pg.query("update planned_workouts set workout_date='2026-09-01' where id=$1",[plan]);
    let result = await f.invoke({}, {method:'GET',query:{start:'2026-10-04',end:'2026-10-04'}});
    assert.equal(result.code,200,JSON.stringify(result.body));
    assert.equal(result.body.workouts.find(w=>w.id===secondPlan).status,'planned'); assert.equal(result.body.activities.length,0);
    assert.equal(result.body.workouts.find(w=>w.id===plan).display_date,'2026-10-04');
    assert.equal(result.body.match_activities[0].linked_workout_id,plan);
    assert.equal(result.body.import_source.strava_connected,true);
    result = await f.invoke({}, {method:'GET',query:{start:'2026-09-01',end:'2026-09-01'}});
    assert.equal(result.code,200,JSON.stringify(result.body)); assert.equal(result.body.workouts[0].linked_activity.id,activity);
    assert.equal(result.body.workouts[0].display_date,'2026-10-04');
  } finally { await f.pg.close(); }
});

test('missing persistence and malformed decisions preserve a safe retry error', async () => {
  const base = {id:plan,match_action:'confirm',activity_id:activity,expected_updated_at:'2026-10-04T12:00:00Z'};
  assert.equal((await decideWorkoutMatch({},owner,{...base,activity_id:'not-an-id'})).status,400);
  assert.equal((await decideWorkoutMatch({},owner,{...base,match_action:'overwrite'})).status,400);
  const result = await decideWorkoutMatch({rpc:async()=>({error:{code:'42883',message:'private schema details'}})},owner,base);
  assert.equal(result.status,503); assert.doesNotMatch(result.error,/private schema/);
});

test('PostgreSQL: deleting the provider activity retains confirmed actuals and permits an explicit unlink', async () => {
  const f=await fixture(); try {
    await f.decision('confirm');
    await f.pg.query('delete from strava_activities where id=$1',[activity]);
    const result=await f.invoke({}, {method:'GET',query:{start:'2026-10-04',end:'2026-10-04'}});
    assert.equal(result.code,200); const saved=result.body.workouts.find(w=>w.id===plan);
    assert.equal(saved.activity_match_state,'unavailable'); assert.equal(Number(saved.completed_duration_min),30);
    assert.equal((await f.decision('confirm')).code,400); assert.equal((await f.decision('reject')).code,200);
  } finally {await f.pg.close();}
});

test('PostgreSQL: legacy duplicate links stop the migration without rewriting training history', async () => {
  const pg=new PGlite(); try {
    await pg.exec(`create table planned_workouts(id uuid primary key,athlete_id uuid,status text,completed_activity_id text);
      insert into planned_workouts values('${plan}','${owner}','completed','${activity}'),('${secondPlan}','${owner}','completed','${activity}');`);
    await pg.exec('begin');
    await assert.rejects(pg.exec(migration),/could not create unique index/);
    await pg.exec('rollback');
    assert.equal((await pg.query('select count(*)::int as n from planned_workouts where completed_activity_id=$1',[activity])).rows[0].n,2);
    assert.equal((await pg.query("select count(*)::int as n from information_schema.columns where table_name='planned_workouts' and column_name='activity_match_mode'")).rows[0].n,0);
  } finally {await pg.close();}
});

test('calendar link lookup is batched and retains confirmed sessions beyond one batch', async () => {
  const f=await fixture(); try {
    await f.pg.exec(`with added as (
      insert into strava_activities(athlete_id,strava_activity_id,name,sport_type,local_date,start_date,moving_time)
      select '${owner}',('batch-' || n),'Historical linked run','Run','2026-10-04','2026-10-04T10:00:00Z',600 from generate_series(1,105) as n returning id
    ) insert into planned_workouts(athlete_id,workout_date,title,status,activity_match_mode,completed_activity_id,completed_duration_min)
    select '${owner}','2026-09-01','Historical plan','completed','manual',id::text,10 from added;`);
    const result=await f.invoke({}, {method:'GET',query:{start:'2026-10-04',end:'2026-10-04'}});
    assert.equal(result.code,200,JSON.stringify(result.body));
    assert.equal(result.body.workouts.filter(w=>w.title==='Historical plan').length,105);
    assert.equal(result.body.match_activities.filter(a=>a.linked_workout_id).length,105);
    assert.equal(result.body.activities.filter(a=>a.name==='Historical linked run').length,0);
  } finally {await f.pg.close();}
});


test('calendar reports disconnected imports while retaining stored activities and match candidates', async () => {
  const f = await fixture({ stravaConnected: false });
  try {
    await f.pg.query("update planned_workouts set activity_match_mode='manual' where athlete_id=$1", [owner]);
    const result = await f.invoke({}, { method: 'GET', query: { start: '2026-10-04', end: '2026-10-05' } });
    assert.equal(result.code, 200, JSON.stringify(result.body));
    assert.equal(result.body.import_source.strava_connected, false);
    assert.ok(result.body.workouts.length > 0);
    assert.ok(result.body.activities.some(a => a.id === replacement));
    assert.ok(result.body.match_activities.some(a => a.id === activity));
  } finally { await f.pg.close(); }
});
