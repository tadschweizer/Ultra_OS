import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createPlannedWorkoutsHandler } from '../../pages/api/planned-workouts.js';
import { createWorkoutLibraryHandler } from '../../pages/api/workout-library.js';
import { resolveEffectiveAthleteId } from '../../lib/auth/requireAthlete.js';
import { signAthleteSession } from '../../lib/auth/sessionCookies.js';

process.env.SESSION_COOKIE_SECRET = 'local-workout-match-tests-secret-32-characters';
export const owner = '11111111-1111-4111-8111-111111111111';
export const other = '22222222-2222-4222-8222-222222222222';
export const plan = '33333333-3333-4333-8333-333333333333';
const secondPlan = '44444444-4444-4444-8444-444444444444';
const activity = '55555555-5555-4555-8555-555555555555';
const replacement = '66666666-6666-4666-8666-666666666666';
const foreign = '77777777-7777-4777-8777-777777777777';
export const coach = '88888888-8888-4888-8888-888888888888';
const migration = readFileSync(new URL('../../supabase/migrations/20261007162647_workout_match_decisions.sql', import.meta.url), 'utf8');
const source = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

// A small PostgREST-shaped adapter executes actual SQL in isolated PostgreSQL.
// No provider traffic, network, production credentials or hosted writes.
function client(pg) {
  return {
    async rpc(name, args) {
      if (name === 'create_workout_library_once') {
        try { return {data:(await pg.query('select public.create_workout_library_once($1,$2,$3) as value',Object.values(args))).rows[0].value}; }
        catch(error) { return {error}; }
      }
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
            // PostgreSQL DATE is a date key over PostgREST, not a timestamp.
            for (const row of rows) if (row.workout_date) row.workout_date = row.workout_date.slice(0, 10);
            return resolve({ data: single ? rows[0] || null : rows });
          } catch (error) { return resolve({ error }); }
        },
      };
      return query;
    },
  };
}

export async function planFixture({ stravaConnected = true } = {}) {
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
  await pg.exec(`alter table athletes add column name text, add column primary_role text default 'athlete',
    add column subscription_tier text default 'free', add column onboarding_complete boolean default true;
    alter table coach_profiles add column display_name text, add column coach_code text, add column bio text,
    add column specialties text, add column certifications text, add column avatar_url text, add column max_athletes integer,
    add column subscription_status text, add column subscription_tier text, add column created_at timestamptz, add column updated_at timestamptz;
    create table coach_athlete_relationships(id uuid default gen_random_uuid(),coach_id uuid,athlete_id uuid,status text,group_name text);`);
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
  await pg.exec(source('20261010025811_workout_library_plan_metadata.sql'));
  await pg.exec(source('20261010042931_workout_library_create_idempotency.sql'));
  await pg.exec(`update athletes set primary_role='coach',subscription_tier='coach_pro' where id='${other}';
    insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${coach}','${owner}','active');`);
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
  const libraryHandler = createWorkoutLibraryHandler({getClient:()=>admin});
  async function invokeLibrary(body = {}, {actor=other,method='GET',query={}}={}) {
    const res={code:200,setHeader(){},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};
    await libraryHandler({method,body,query,headers:{origin:process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000','content-type':'application/json',cookie:actor?`athlete_id=${signAthleteSession(actor)}`:''}},res);
    return res;
  }
  async function invoke(body = {}, { actor = owner, method = 'PATCH', query = {} } = {}) {
    const req = { method, body, query, headers: { cookie: actor ? `athlete_id=${signAthleteSession(actor)}` : '' } };
    const res = { code: 200, status(c) { this.code=c; return this; }, json(b) { this.body=b; return this; } };
    await handler(req,res); return res;
  }
  const decision = async (action, id = activity, workout = plan) => invoke({ id: workout, match_action: action, activity_id: id, expected_updated_at: (await row(workout)).updated_at.toISOString() });
  return { pg, admin, handler, row, invoke, invokeLibrary, decision, close: () => pg.close() };
}
