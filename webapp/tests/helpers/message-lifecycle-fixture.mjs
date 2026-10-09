import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createCoachMessagesHandler } from '../../pages/api/coach/messages.js';
import { createMessageCenterHandler } from '../../pages/api/message-center.js';
import { createMessageDraftHandler } from '../../pages/api/message-drafts.js';
import { createMessagePreferencesHandler } from '../../pages/api/message-preferences.js';
import { createMessageEmailWorker } from '../../pages/api/messages/deliver-pending.js';
import { signAthleteSession } from '../../lib/auth/sessionCookies.js';

process.env.SESSION_COOKIE_SECRET='message-lifecycle-tests-secret-32-characters';
process.env.NEXT_PUBLIC_SITE_URL='https://threshold.example';
export const owner='11111111-1111-4111-8111-111111111111',athlete='22222222-2222-4222-8222-222222222222',
  stranger='33333333-3333-4333-8333-333333333333',coach='44444444-4444-4444-8444-444444444444',
  plan='55555555-5555-4555-8555-555555555555',message='66666666-6666-4666-8666-666666666666',
  otherMessage='77777777-7777-4777-8777-777777777777';
const migration=readFileSync(new URL('../../supabase/migrations/20261008231639_message_delivery_and_drafts.sql',import.meta.url),'utf8');
export function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};}
export function client(pg){
  return {async rpc(name,args={}){
    try{return {data:(await pg.query(`select public.${name}(${Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',')}) as data`,Object.values(args))).rows[0].data};}
    catch(error){return {error};}
  },from(table){
    assert.match(table,/^[a-z_]+$/);let fields='*',patch,insert,upsert=false,conflict='athlete_id',single=false,limit,filters=[],values=[],orders=[];
    const add=(k,op,v)=>{assert.match(k,/^[a-z_]+$/);values.push(v);filters.push(`${k} ${op} $${values.length}`);};
    let deleting=false;
    const q={select(v='*'){fields=v;return this;},eq(k,v){add(k,'=',v);return this;},is(k,v){assert.equal(v,null);filters.push(`${k} is null`);return this;},
      match(v){for(const [k,value] of Object.entries(v))add(k,'=',value);return this;},
      in(k,v){values.push(v);filters.push(`${k}::text=any($${values.length}::text[])`);return this;},
      order(k,{ascending=true}={}){orders.push(`${k} ${ascending?'asc':'desc'}`);return this;},limit(v){limit=v;return this;},
      update(v){patch=v;return this;},insert(v){insert=v;return this;},upsert(v,options){insert=v;upsert=true;conflict=options?.onConflict||'athlete_id';assert.match(conflict,/^[a-z_,]+$/);return this;},
      delete(){deleting=true;return this;},
      maybeSingle(){single=true;return this;},single(){single=true;return this;},
      async then(resolve){try{
        const where=filters.length?` where ${filters.join(' and ')}`:'';let sql;
        if(deleting)sql=`delete from ${table}${where} returning ${fields}`;
        else if(patch){const assigns=Object.entries(patch).map(([k,v])=>{values.push(v);return `${k}=$${values.length}`;});sql=`update ${table} set ${assigns.join(',')}${where} returning ${fields}`;}
        else if(insert){const keys=Object.keys(insert);values=Object.values(insert);sql=`insert into ${table}(${keys.join(',')}) values(${keys.map((_,i)=>`$${i+1}`).join(',')})`;
          if(upsert){const updates=keys.filter(k=>!conflict.split(',').includes(k));sql+=` on conflict(${conflict}) do ${updates.length?'update set '+updates.map(k=>`${k}=excluded.${k}`).join(','):'nothing'}`;}
          sql+=` returning ${fields}`;}
        else sql=`select ${fields} from ${table}${where}${orders.length?' order by '+orders.join(','):''}${limit?' limit '+limit:''}`;
        const rows=JSON.parse(JSON.stringify((await pg.query(sql,values)).rows));return resolve({data:single?rows[0]||null:rows});
      }catch(error){return resolve({error});}}
    };return q;
  }};
}
export async function fixture({ releasePrerequisites=false }={}){
  const pg=new PGlite();
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table athletes(id uuid primary key,name text,email text,primary_role text default 'athlete',subscription_tier text default 'free',
      is_admin boolean default false,onboarding_complete boolean default true,session_version integer default 1,notification_preferences jsonb,email_verified_at timestamptz default now());
    create table coach_profiles(id uuid primary key,athlete_id uuid references athletes(id) on delete cascade,display_name text,
      coach_code text,bio text,specialties text,certifications text,avatar_url text,max_athletes integer,subscription_status text,subscription_tier text,created_at timestamptz,updated_at timestamptz);
    create table coach_athlete_relationships(id uuid primary key default gen_random_uuid(),coach_id uuid references coach_profiles(id),athlete_id uuid references athletes(id),status text,group_name text,created_at timestamptz default now());
    create table planned_workouts(id uuid primary key,athlete_id uuid,title text,workout_date date,sport text);
    create table strava_activities(id uuid primary key,athlete_id uuid,name text,local_date date,sport_type text);
    create table workout_comments(id uuid primary key default gen_random_uuid(),athlete_id uuid,planned_workout_id uuid,activity_id uuid,sender_role text,body text,created_at timestamptz default now(),read_at timestamptz);`);
  const legacy=readFileSync(new URL('../../supabase/migrations/20260501110000_add_coach_groups_and_messages.sql',import.meta.url),'utf8');
  if(!releasePrerequisites)await pg.exec(legacy);
  await pg.exec(readFileSync(new URL('../../supabase/migrations/20260617120000_trainingpeaks_parity_foundation.sql',import.meta.url),'utf8').split('CREATE TABLE IF NOT EXISTS public.coach_notifications')[1].split('CREATE TABLE IF NOT EXISTS public.trainingpeaks_import_jobs')[0].replace(/^/, 'CREATE TABLE IF NOT EXISTS public.coach_notifications'));
  await pg.exec(`insert into athletes(id,name,email,primary_role) values('${owner}','Coach','coach@example.test','athlete'),('${athlete}','Runner','runner@example.test','athlete'),('${stranger}','Other','other@example.test','athlete');
    insert into coach_profiles(id,athlete_id,display_name) values('${coach}','${owner}','Coach');
    insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${coach}','${athlete}','active');
    insert into planned_workouts values('${plan}','${athlete}','Easy run','2026-10-08','run');`);
  let prerequisiteGrants, releaseStages=[];
  if(releasePrerequisites){
    await pg.exec('alter table athletes drop column notification_preferences;');
    await pg.exec(`create table coach_groups(id uuid primary key default gen_random_uuid(),coach_id uuid references coach_profiles(id),
      name text,color text,sort_order integer,created_at timestamptz default now(),updated_at timestamptz default now());
      alter table coach_groups enable row level security;
      alter table planned_workouts add column status text default 'planned', add column completed_activity_id text,
      add column completed_duration_min numeric, add column completed_distance_km numeric, add column updated_at timestamptz default now();
      alter table strava_activities add column moving_time integer, add column distance numeric;
      alter table workout_comments enable row level security;
      alter table coach_notifications enable row level security;
      revoke all on workout_comments,coach_notifications from public,anon,authenticated;`);
    await pg.exec(readFileSync(new URL('../../supabase/migrations/20261009201251_pilot_release_prerequisites.sql',import.meta.url),'utf8'));
    releaseStages.push((await pg.query('select public.pilot_schema_readiness() as ready')).rows[0].ready);
    prerequisiteGrants=(await pg.query(`select bool_and(has_table_privilege('service_role',t,action)) as allowed
      from unnest(array['public.coach_messages','public.coach_shared_docs','public.coach_group_members']) t
      cross join unnest(array['select','insert','update','delete']) action`)).rows[0].allowed;
    await pg.exec(readFileSync(new URL('../../supabase/migrations/20261007162647_workout_match_decisions.sql',import.meta.url),'utf8'));
    releaseStages.push((await pg.query('select public.pilot_schema_readiness() as ready')).rows[0].ready);
  }
  await pg.exec(migration);
  if(releasePrerequisites)await pg.exec(readFileSync(new URL('../../supabase/migrations/20261009204246_message_foreign_key_indexes.sql',import.meta.url),'utf8'));
  if(releasePrerequisites)await pg.exec(readFileSync(new URL('../../supabase/migrations/20261009204853_pilot_conflict_responses.sql',import.meta.url),'utf8'));
  if(releasePrerequisites)await pg.exec(readFileSync(new URL('../../supabase/migrations/20261009205343_pilot_notification_preferences.sql',import.meta.url),'utf8'));
  await pg.exec('grant usage on schema public to service_role;grant select,insert,update,delete on all tables in schema public to service_role;set role service_role;');
  const admin=client(pg);const opts={getClient:()=>admin};
  const handlers={messages:createCoachMessagesHandler(opts),center:createMessageCenterHandler(opts),draft:createMessageDraftHandler(opts),preferences:createMessagePreferencesHandler({...opts,emailAvailable:()=>true})};
  async function invoke(name,{actor=owner,method='GET',body={},query={},origin='https://threshold.example',version=1}={}){
    const req={method,body,query,headers:{origin,'content-type':'application/json',cookie:actor?`athlete_id=${signAthleteSession(actor,version)}`:''}};
    const res=response();await handlers[name](req,res);return res;
  }
  const rpc=async(name,args)=>{const result=await admin.rpc(name,args);if(result.error)throw result.error;return result.data;};
  const send=(id=message,role='coach',body='Private training details')=>invoke('messages',{actor:role==='coach'?owner:athlete,method:'POST',body:{mode:role,athlete_id:athlete,message_body:body,client_message_id:id}});
  return {pg,admin,invoke,rpc,send,prerequisiteGrants,releaseStages,close:()=>pg.close()};
}

