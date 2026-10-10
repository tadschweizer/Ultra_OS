import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createPlannedWorkoutsHandler } from '../../pages/api/planned-workouts.js';
import { createMeHandler } from '../../pages/api/me.js';
import { createWorkoutCommentsHandler } from '../../pages/api/workout-comments.js';
import { createWorkoutExportHandler } from '../../pages/api/workout-export.js';
import { createCoachAthleteDetailHandler } from '../../pages/api/coach/athlete-detail.js';
import { createAccountExportHandler } from '../../pages/api/account-export.js';
import { signAthleteSession } from '../../lib/auth/sessionCookies.js';
import { resolveEffectiveAthleteId } from '../../lib/auth/requireAthlete.js';

process.env.SESSION_COOKIE_SECRET = 'isolated-calendar-gap-tests-secret-32-chars';
export const athlete='11111111-1111-4111-8111-111111111111', owner='22222222-2222-4222-8222-222222222222',
  coach='33333333-3333-4333-8333-333333333333', plan='44444444-4444-4444-8444-444444444444',
  library='55555555-5555-4555-8555-555555555555', activity='66666666-6666-4666-8666-666666666666',
  request='77777777-7777-4777-8777-777777777777', stranger='88888888-8888-4888-8888-888888888888',
  otherCoach='99999999-9999-4999-8999-999999999999';
export const migration=name=>readFileSync(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
export const copyBody={action:'copy_week',athlete_id:athlete,client_request_id:request,from_week_start:'2026-10-05',to_week_start:'2026-10-12'};

// Actual SQL and constraints; no external database, provider or fixture seeder.
export function sqlClient(pg) {
  const calls=[];
  return {calls,async rpc(name,args){
    calls.push({table:name,operation:'rpc',args});assert.match(name,/^[a-z_]+$/);
    try{return {data:(await pg.query(`select public.${name}(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) as data`,Object.values(args))).rows[0].data};}
    catch(error){return {error};}
  },from(table){
    assert.match(table,/^[a-z_]+$/);let fields='*',patch,insert,single=false,limit,offset,count=false,head=false,deleting=false;
    const filters=[],values=[],orders=[];
    const add=(k,op,v)=>{assert.match(k,/^[a-z_]+$/);values.push(v);filters.push(`${k} ${op} $${values.length}`);};
    const q={select(v='*',options={}){fields=v;count=options.count==='exact';head=options.head===true;return q;},
      eq(k,v){add(k,'=',v);return q;},gte(k,v){add(k,'>=',v);return q;},lte(k,v){add(k,'<=',v);return q;},
      not(k,op,v){assert.equal(op,'is');assert.equal(v,null);filters.push(`${k} is not null`);return q;},
      is(k,v){assert.equal(v,null);filters.push(`${k} is null`);return q;},
      match(v){for(const [k,value]of Object.entries(v))add(k,'=',value);return q;},
      in(k,v){values.push(v);filters.push(`${k}::text=any($${values.length}::text[])`);return q;},
      order(k,{ascending=true}={}){orders.push(`${k} ${ascending?'asc':'desc'}`);return q;},limit(n){limit=n;return q;},
      range(start,end){offset=start;limit=end-start+1;return q;},
      update(v){patch=v;return q;},insert(v){insert=v;return q;},delete(){deleting=true;return q;},
      single(){single=true;return q;},maybeSingle(){single=true;return q;},
      async then(resolve){try{
        calls.push({table,operation:insert?'insert':patch?'update':deleting?'delete':'select',filters:[...filters],values:[...values],limit,offset});
        const where=filters.length?` where ${filters.join(' and ')}`:'';let sql;
        if(insert){assert.equal(Array.isArray(insert),false);const keys=Object.keys(insert);values.push(...Object.values(insert));
          sql=`insert into ${table}(${keys.join(',')}) values(${keys.map((_,i)=>`$${i+1}`).join(',')}) returning ${fields}`;}
        else if(patch){const sets=Object.entries(patch).map(([k,v])=>{values.push(v);return `${k}=$${values.length}`;});sql=`update ${table} set ${sets.join(',')}${where} returning ${fields}`;}
        else if(deleting)sql=`delete from ${table}${where} returning ${fields}`;
        else sql=`select ${fields} from ${table}${where}${orders.length?' order by '+orders.join(','):''}${limit?' limit '+limit:''}${offset?' offset '+offset:''}`;
        const rows=JSON.parse(JSON.stringify((await pg.query(sql,values)).rows));
        for(const row of rows)for(const key of ['workout_date','date','local_date'])if(row[key])row[key]=row[key].slice(0,10);
        // PostgREST emits numeric SQL columns as JSON numbers. PGlite's direct
        // query adapter emits NUMERIC as strings, so match the production wire.
        for(const row of rows)for(const key of ['planned_duration_min','planned_distance_km','planned_tss','planned_if','completed_duration_min','completed_distance_km'])if(row[key]!=null)row[key]=Number(row[key]);
        return resolve({data:head?null:single?rows[0]||null:rows,...(count?{count:rows.length}:{})});
      }catch(error){return resolve({error});}}
    };return q;
  }};
}

export async function calendarFixture({ applyFix=true, libraryMetadata=true }={}) {
  const pg=new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''fixture.auth_uid'',true),'''')::uuid';
    create function public.is_current_athlete(uuid) returns boolean language sql as 'select false';
    create table athletes(id uuid primary key, name text, email text, primary_role text default 'athlete', subscription_tier text default 'core',
      is_admin boolean default false,onboarding_complete boolean default true,session_version integer default 1,notification_preferences jsonb default '{}',
      supabase_user_id uuid, strava_id text,token_expires_at bigint,primary_sports text[],years_racing_band text,weekly_training_hours_band text,
      home_elevation_ft numeric,target_race_id uuid,stripe_subscription_id text,stripe_subscription_status text,email_verified_at timestamptz);
    create table athlete_settings(athlete_id uuid primary key);
    create table coach_profiles(id uuid primary key,athlete_id uuid references athletes(id),display_name text,coach_code text,bio text,specialties text,
      certifications text,avatar_url text,max_athletes integer,subscription_status text,subscription_tier text,created_at timestamptz,updated_at timestamptz);
    create table coach_athlete_relationships(id uuid primary key default gen_random_uuid(),coach_id uuid,athlete_id uuid,status text,group_name text,
      created_at timestamptz default now(),removed_at timestamptz,expires_at timestamptz);
    create table interventions(id uuid primary key default gen_random_uuid(),athlete_id uuid,date date,inserted_at timestamptz default now(),
      intervention_type text,dose_duration text,subjective_feel integer,protocol_payload jsonb);
    create table coach_pilot_entitlements(coach_id uuid,starts_at timestamptz,expires_at timestamptz,revoked_at timestamptz);
    create table races(id uuid,athlete_id uuid,name text,event_date date,race_type text);
    create table coach_protocol_assignments(id uuid,athlete_id uuid,created_at timestamptz);
    create table daily_checkins(athlete_id uuid,created_at timestamptz);
    create table coach_notes(coach_id uuid,athlete_id uuid,created_at timestamptz);
    create table trainingpeaks_import_jobs(id uuid,athlete_id uuid,status text,transferred_count integer,needs_manual_mapping_count integer,
      error_message text,created_at timestamptz,updated_at timestamptz,followup_sent_at timestamptz);`);
  await pg.exec(migration('20260611120000_add_training_calendar.sql'));
  await pg.exec(migration('20260617120000_trainingpeaks_parity_foundation.sql').split('CREATE TABLE IF NOT EXISTS public.workout_comments')[0]);
  await pg.exec(migration('20260721120000_workout_units_and_targets.sql'));
  await pg.exec(migration('20260725000000_activity_sync_persistence.sql'));
  await pg.exec(migration('20261007162647_workout_match_decisions.sql'));
  await pg.exec(`create table workout_comments(id uuid primary key default gen_random_uuid(),athlete_id uuid,coach_id uuid,author_athlete_id uuid,
    planned_workout_id uuid,activity_id uuid,sender_role text,body text,created_at timestamptz default now(),read_at timestamptz);`);
  await pg.exec(`insert into athletes(id,name,supabase_user_id) values('${athlete}','Synthetic runner','${athlete}'),('${owner}','Synthetic coach','${owner}'),('${stranger}','Other athlete','${stranger}');
    insert into coach_profiles(id,athlete_id) values('${coach}','${owner}'),('${otherCoach}','${stranger}');
    update athletes set primary_role='coach',subscription_tier='coach_pro' where id='${owner}';
    insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${coach}','${athlete}','active');
    insert into workout_library(id,coach_id,name) values('${library}','${coach}','Trail climbs');
    insert into planned_workouts(id,athlete_id,coach_id,workout_date,sport,title,description,structure,planned_duration_min,planned_distance_km,
      planned_distance_unit,planned_tss,order_index,library_workout_id,objective,coach_instructions,target_metric,planned_if,visibility,status,
      completed_duration_min,completed_distance_km,athlete_rpe,athlete_comment,coach_feedback,export_status,sync_provider)
    values('${plan}','${athlete}','${coach}','2026-10-05','run','Trail climbs','Controlled climbing session',
      '[{"type":"work","repeat":4,"duration_min":5,"intensity":"z3","target_type":"pace","target_low":8,"target_high":9,"target_units":"min/mi","notes":"Hike steep grades"}]',60,8,'km',65,2,'${library}',
      'Efficient uphill movement','Keep descents easy; use poles on steep climbs','distance',0.75,'coach_private','completed',55,7.8,6,'Legs good','Good pacing','exported','fixture');`);
  if(libraryMetadata) {
    // Read-only PR135 migration checkpoint, applied only in synthetic PGlite.
    await pg.exec(readFileSync(new URL('./contracts/workout-library-metadata.sql',import.meta.url),'utf8'));
    await pg.exec(`update workout_library set structure=(select structure from planned_workouts where id='${plan}'),planned_distance_unit='km',
      objective='Efficient uphill movement',coach_instructions='Keep descents easy; use poles on steep climbs',
      planned_if=0.75,target_metric='distance',visibility='coach_private';`);
  }
  if(applyFix)await pg.exec(migration('20261010030000_private_workouts_and_week_copy.sql'));
  await pg.exec('grant usage on schema public,auth to service_role;grant select,insert,update,delete on all tables in schema public to service_role;set role service_role;');
  const admin=sqlClient(pg);
  const resolveAthlete=async req=>(await resolveEffectiveAthleteId(req,admin)).athleteId;
  const fetchActivities=async(_admin,id,start,end)=>({activities:JSON.parse(JSON.stringify((await pg.query('select * from strava_activities where athlete_id=$1 and start_date >= $2 and start_date <= $3',[id,start,`${end}T23:59:59Z`])).rows)),stravaConnected:false});
  const handlers={calendar:createPlannedWorkoutsHandler({getAdmin:()=>admin,resolveAthlete,fetchActivities}),me:createMeHandler({getAdmin:()=>admin}),detail:createCoachAthleteDetailHandler({getAdmin:()=>admin}),
    comments:createWorkoutCommentsHandler({getAdmin:()=>admin,resolveAthlete}),export:createWorkoutExportHandler({getAdmin:()=>admin,resolveAthlete}),archive:createAccountExportHandler({getClient:()=>admin})};
  async function invoke(name='calendar',{actor=athlete,method='GET',query={},body={},version=1}={}){
    const req={method,query,body,headers:{origin:'http://localhost:3000','content-type':'application/json',cookie:actor?`athlete_id=${signAthleteSession(actor,version)}`:''}};
    const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(b){this.body=b;return this;},send(b){this.body=b;return this;}};
    await handlers[name](req,res);return res;
  }
  return {pg,admin,handlers,invoke,close:()=>pg.close()};
}
