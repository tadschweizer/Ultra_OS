import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { calendarFixture,copyBody,athlete,owner,coach,plan,library,activity,request,stranger,otherCoach,migration } from './helpers/calendar-gap-fixture.mjs';
import { buildLoadMetrics,buildLoadStatus } from '../lib/loadRollups.js';
import { computeActivityTrimp } from '../lib/trainingLoad.js';
import { createCopyWeekRequests } from '../lib/copyWeekRequest.js';
import { calendarMutation } from '../lib/calendarMutation.js';
import { fixture as messageFixture,athlete as messageAthlete,owner as messageOwner,coach as messageCoach,plan as messagePlan,stranger as messageStranger } from './helpers/message-lifecycle-fixture.mjs';

test('private drafts: athlete hidden; assigning linked coach sees; cross-athlete/unrelated/revoked callers denied',async()=>{
  const f=await calendarFixture();try{
    const query={start:'2026-10-05',end:'2026-10-18'};
    const own=await f.invoke('calendar',{query});assert.equal(own.code,200);assert.deepEqual(own.body.workouts,[]);
    const linked=await f.invoke('calendar',{actor:owner,query:{...query,athlete_id:athlete}});assert.equal(linked.body.workouts.length,1);
    assert.equal((await f.invoke('calendar',{actor:stranger,query:{...query,athlete_id:athlete}})).code,403);
    assert.equal((await f.invoke('calendar',{query:{...query,athlete_id:stranger}})).code,403);
    for(const [name,query] of [['comments',{workout_id:plan}],['export',{id:plan}]])assert.equal((await f.invoke(name,{query})).code,404,name);
    assert.equal((await f.invoke('calendar',{method:'PATCH',body:{id:plan,status:'completed'}})).code,404);
    assert.equal((await f.invoke('calendar',{method:'DELETE',query:{id:plan}})).code,404);
    assert.equal((await f.invoke('comments',{actor:owner,query:{workout_id:plan}})).code,200);
    assert.equal((await f.invoke('detail',{actor:owner,query:{athlete_id:athlete}})).body.plannedWorkouts.length,1);
    await f.pg.exec(`insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${otherCoach}','${athlete}','active');`);
    await f.pg.exec(`update athletes set primary_role='coach',subscription_tier='coach_pro' where id='${stranger}';`);
    assert.deepEqual((await f.invoke('calendar',{actor:stranger,query:{...query,athlete_id:athlete}})).body.workouts,[]);
    assert.equal((await f.invoke('comments',{actor:stranger,query:{workout_id:plan}})).code,404);
    assert.deepEqual((await f.invoke('detail',{actor:stranger,query:{athlete_id:athlete}})).body.plannedWorkouts,[]);
    await f.pg.query("insert into strava_activities(id,athlete_id,start_date,moving_time,strava_activity_id) values($1,$2,$3,$4,'outside-private-fixture')",[activity,athlete,'2026-10-16T09:00:00Z',3600]);
    await f.pg.query('update planned_workouts set completed_activity_id=$1 where id=$2',[activity,plan]);
    const outsideQuery={start:'2026-10-16',end:'2026-10-16'};
    const outside=await f.invoke('calendar',{query:outsideQuery});assert.deepEqual(outside.body.workouts,[]);
    assert.equal(outside.body.match_activities[0].linked_workout_id,null,'outside-range private link ID hidden');
    assert.equal((await f.invoke('calendar',{actor:owner,query:{...outsideQuery,athlete_id:athlete}})).body.workouts[0].id,plan);
    assert.deepEqual((await f.invoke('calendar',{actor:stranger,query:{...outsideQuery,athlete_id:athlete}})).body.workouts,[]);
    const published=await f.invoke('calendar',{actor:owner,method:'PATCH',body:{id:plan,visibility:'athlete_visible'}});
    assert.equal(published.code,200);assert.equal((await f.invoke('calendar',{query:outsideQuery})).body.workouts[0].id,plan,'explicit coach publication makes plan readable');
    assert.equal((await f.invoke('calendar',{actor:owner,method:'PATCH',body:{id:plan,visibility:'coach_private'}})).code,200);
    assert.deepEqual((await f.invoke('calendar',{query:outsideQuery})).body.workouts,[],'making draft private again hides it');
    await f.pg.exec(`update coach_athlete_relationships set status='revoked' where coach_id='${coach}';`);
    assert.equal((await f.invoke('calendar',{actor:owner,query:{...query,athlete_id:athlete}})).code,403);
    assert.equal((await f.invoke('calendar',{actor:owner,method:'POST',body:copyBody})).code,403);
    assert.equal((await f.invoke('detail',{actor:owner,query:{athlete_id:athlete}})).code,403);
    await f.pg.exec(`update athletes set session_version=2 where id='${owner}';`);
    assert.equal((await f.invoke('calendar',{actor:owner,query:{...query,athlete_id:athlete}})).code,401);
    assert.equal((await f.invoke('export',{actor:owner,query:{id:plan}})).code,401);
    assert.equal((await f.invoke('calendar',{actor:null,query})).code,401);
  }finally{await f.close();}
});

test('actual PostgreSQL copy: concurrent/same/lost-response replay once, new operation twice; full prescription survives',async(t)=>{
  const f=await calendarFixture();try{
    const invoke=body=>f.invoke('calendar',{actor:owner,method:'POST',body});
    const results=await Promise.all([invoke(copyBody),invoke(copyBody)]);
    assert.ok(results.every(r=>r.code===200),JSON.stringify(results));
    assert.deepEqual(results.map(r=>r.body.replayed).sort(),[false,true]);
    assert.equal((await f.pg.query("select count(*)::int n from planned_workouts where workout_date='2026-10-12'")).rows[0].n,1);
    const source=(await f.pg.query('select * from planned_workouts where id=$1',[plan])).rows[0];
    const clone=results[0].body.workouts[0];
    for(const key of ['objective','coach_instructions','target_metric','visibility','structure','planned_distance_unit'])assert.deepEqual(clone[key],source[key],key);
    assert.equal(clone.planned_if,Number(source.planned_if));
    for(const key of ['completed_activity_id','completed_duration_min','completed_distance_km','athlete_rpe','athlete_comment','coach_feedback','sync_provider'])assert.equal(clone[key],null,key);
    assert.equal(clone.status,'planned');assert.equal(clone.export_status,'not_exported');
    assert.equal((await invoke({...copyBody,to_week_start:'2026-10-19'})).code,409);
    assert.equal((await invoke({...copyBody,athlete_id:stranger})).code,403);
    await f.pg.exec(`insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${coach}','${stranger}','active');`);
    assert.equal((await invoke({...copyBody,athlete_id:stranger})).code,409,'same key cannot change to another authorized athlete');
    let lost=true;
    t.mock.method(globalThis,'fetch',async(_url,options)=>{
      const response=await invoke(JSON.parse(options.body));
      if(lost){lost=false;throw Error('lost response after real SQL transaction');}
      return Response.json(response.body,{status:response.code});
    });
    const retryBody={...copyBody,client_request_id:randomUUID(),to_week_start:'2026-10-19'};
    assert.equal((await calendarMutation('/api/planned-workouts',{body:retryBody})).ok,false);
    assert.equal((await calendarMutation('/api/planned-workouts',{body:retryBody})).replayed,true);
    assert.equal((await f.pg.query("select count(*)::int n from planned_workouts where workout_date='2026-10-19'")).rows[0].n,1);
    assert.equal((await invoke({...copyBody,client_request_id:randomUUID()})).body.replayed,false);
    assert.equal((await f.pg.query("select count(*)::int n from planned_workouts where workout_date='2026-10-12'")).rows[0].n,2);
    const ids=results[0].body.workouts.map(w=>w.id);
    await f.pg.query('delete from planned_workouts where id=$1',[ids[0]]);
    assert.deepEqual((await invoke(copyBody)).body.workouts,[],'replay never resurrects deletion');
    for(const body of [{...copyBody,client_request_id:undefined},{...copyBody,from_week_start:'2026-02-30'},{...copyBody,to_week_start:copyBody.from_week_start}])assert.equal((await invoke(body)).code,400);
    assert.equal((await f.invoke('calendar',{method:'POST',body:{...copyBody,athlete_id:undefined,client_request_id:randomUUID()}})).code,400,'athlete cannot copy private source');
    await f.pg.exec(`reset role;create function reject_copy() returns trigger language plpgsql as $$begin if new.workout_date='2026-10-26' then raise exception 'fixture failure';end if;return new;end$$;
      create trigger reject_copy before insert on planned_workouts for each row execute function reject_copy();set role service_role;`);
    const failedKey=randomUUID();assert.equal((await invoke({...copyBody,client_request_id:failedKey,to_week_start:'2026-10-26'})).code,503);
    assert.equal((await f.pg.query('select count(*)::int n from workout_week_copies where request_id=$1',[failedKey])).rows[0].n,0,'failed copy rolls back retry record');
  }finally{await f.close();}
});

test('copy key survives uncertain response/refresh; successful write releases it before failed refresh; next copy distinct',()=>{
  const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  const first=createCopyWeekRequests({storage,scope:owner,randomUUID}).begin(copyBody);
  const refreshed=createCopyWeekRequests({storage,scope:owner,randomUUID});
  assert.equal(refreshed.begin(copyBody).client_request_id,first.client_request_id);
  refreshed.complete(first); // release on write success, independent of GET refresh
  const next=createCopyWeekRequests({storage,scope:owner,randomUUID}).begin(copyBody);
  assert.notEqual(next.client_request_id,first.client_request_id);
  assert.notEqual(createCopyWeekRequests({storage,scope:stranger,randomUUID}).begin(copyBody).client_request_id,next.client_request_id);
});

test('direct private create and library assignment preserve metadata; absent library schema/RPC fail honestly',async()=>{
  const f=await calendarFixture();try{
    const body={athlete_id:athlete,workout_date:'2026-10-07',title:'Private new plan',visibility:'coach_private',objective:'Objective',coach_instructions:'Instructions',target_metric:'distance',planned_if:0.8};
    const created=await f.invoke('calendar',{actor:owner,method:'POST',body});assert.equal(created.code,200);
    assert.equal(created.body.workout.coach_instructions,'Instructions');
    const assigned=await f.invoke('calendar',{actor:owner,method:'POST',body:{athlete_id:athlete,workout_date:'2026-10-08',library_workout_id:library}});
    assert.equal(assigned.code,200,JSON.stringify(assigned.body));
    assert.equal(assigned.body.workout.visibility,'coach_private');assert.equal(assigned.body.workout.target_metric,'distance');assert.equal(assigned.body.workout.planned_if,0.75);
    assert.equal(assigned.body.workout.objective,'Efficient uphill movement');assert.match(assigned.body.workout.coach_instructions,/poles/);
    assert.equal(assigned.body.workout.structure[0].target_units,'min/mi');assert.equal(assigned.body.workout.structure[0].repeat,4);
    assert.equal(assigned.body.workout.planned_distance_unit,'km');
    for(const field of ['planned_duration_min','planned_distance_km','planned_tss'])assert.equal(assigned.body.workout[field],null,'nullable library total stays unknown');
    const assignBody={athlete_id:athlete,workout_date:'2026-10-08',library_workout_id:library};
    const overridden=await f.invoke('calendar',{actor:owner,method:'POST',body:{...assignBody,objective:null,coach_instructions:null,planned_if:0,target_metric:'rpe',visibility:'athlete_visible',planned_duration_min:null,planned_distance_km:0,planned_tss:0,planned_distance_unit:'km',structure:[{type:'work',duration_min:30,distance_km:5,intensity:'z2'}]}});
    assert.equal(overridden.code,200);assert.equal(overridden.body.workout.objective,null);assert.equal(overridden.body.workout.coach_instructions,null);
    assert.equal(overridden.body.workout.planned_if,0);assert.equal(overridden.body.workout.target_metric,'rpe');
    assert.equal(overridden.body.workout.planned_duration_min,null);assert.equal(overridden.body.workout.planned_distance_km,0);
    assert.equal(overridden.body.workout.planned_tss,0);assert.equal(overridden.body.workout.planned_distance_unit,'km');
    const derived=await f.invoke('calendar',{actor:owner,method:'POST',body:{athlete_id:athlete,title:'Omitted totals derive',workout_date:'2026-10-09',structure:[{type:'work',duration_min:30,intensity:'z2'}]}});
    assert.equal(derived.body.workout.planned_duration_min,30);assert.ok(derived.body.workout.planned_tss>0);
    const omitted=await f.invoke('calendar',{actor:owner,method:'PATCH',body:{id:overridden.body.workout.id,title:'Retain omitted metadata'}});
    assert.equal(omitted.body.workout.planned_if,0);assert.equal(omitted.body.workout.target_metric,'rpe');
    const cleared=await f.invoke('calendar',{actor:owner,method:'PATCH',body:{id:overridden.body.workout.id,planned_if:null}});
    assert.equal(cleared.body.workout.planned_if,null);
    for(const invalid of [{target_metric:null},{target_metric:'invalid'},{visibility:null},{objective:'x'.repeat(10001)},{coach_instructions:45},{planned_if:-1}]) {
      assert.equal((await f.invoke('calendar',{actor:owner,method:'POST',body:{...assignBody,...invalid}})).code,400);
    }
    await f.pg.exec(`insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${otherCoach}','${athlete}','active');
      update athletes set primary_role='coach',subscription_tier='coach_pro' where id='${stranger}';`);
    assert.equal((await f.invoke('calendar',{actor:stranger,method:'POST',body:assignBody})).code,404,'library lookup retains assigning coach owner scope');
    assert.equal((await f.invoke('calendar',{method:'POST',body:{workout_date:'2026-10-08',title:'Athlete draft',visibility:'coach_private'}})).code,403);
    await f.pg.exec('reset role;alter table workout_library drop column objective;set role service_role;');
    assert.equal((await f.invoke('calendar',{actor:owner,method:'POST',body:{athlete_id:athlete,workout_date:'2026-10-08',library_workout_id:library}})).code,503);
    await f.pg.exec('reset role;drop function copy_planned_workout_week(uuid,uuid,uuid,date,date);set role service_role;');
    assert.equal((await f.invoke('calendar',{actor:owner,method:'POST',body:copyBody})).code,503);
  }finally{await f.close();}
});

test('RLS/privileges: direct athlete reads cannot expose private rows; service RPC and retry table remain client-denied',async()=>{
  const f=await calendarFixture();try{
    await f.pg.exec(`reset role;grant usage on schema public,auth to authenticated,anon;
      grant select on planned_workouts,athletes,coach_profiles,coach_athlete_relationships to authenticated;
      select set_config('fixture.auth_uid','${athlete}',false);set role authenticated;`);
    assert.equal((await f.pg.query('select count(*)::int n from planned_workouts')).rows[0].n,0);
    await assert.rejects(f.pg.query('select * from workout_week_copies'),e=>e.code==='42501');
    await assert.rejects(f.pg.query('select copy_planned_workout_week($1,$2,$3,$4,$5)',[owner,athlete,request,'2026-10-05','2026-10-12']),e=>e.code==='42501');
    await f.pg.exec(`reset role;select set_config('fixture.auth_uid','${owner}',false);set role authenticated;`);
    assert.equal((await f.pg.query('select count(*)::int n from planned_workouts')).rows[0].n,1);
    await f.pg.exec(`reset role;update coach_athlete_relationships set status='revoked';set role authenticated;`);
    assert.equal((await f.pg.query('select count(*)::int n from planned_workouts')).rows[0].n,0);
  }finally{await f.close();}
});

test('load matrix: actual manual/synced/matched counts, unknown values and recovery provenance',()=>{
  const now=new Date('2026-10-10T12:00:00Z'),recovery={date:'2026-10-10',dose_duration:30,subjective_feel:6};
  const synced={id:activity,local_date:'2026-10-10',start_date:'2026-10-10T09:00:00Z',moving_time:3600,average_heartrate:140};
  const manual={id:plan,workout_date:'2026-10-10',status:'completed',completed_duration_min:60,athlete_rpe:6,planned_tss:999};
  const cases=[
    [{},'none',0], [{interventions:[recovery]},'none',0],
    [{workouts:[manual]},'manual_completions',computeActivityTrimp({moving_time:3600,perceived_exertion:6})],
    [{activities:[synced],interventions:[recovery]},'synced_activities',computeActivityTrimp(synced)],
    [{activities:[synced],workouts:[{...manual,completed_activity_id:activity}]},'synced_activities',computeActivityTrimp(synced)],
    [{activities:[synced],workouts:[manual]},'mixed',computeActivityTrimp(synced)+computeActivityTrimp({moving_time:3600,perceived_exertion:6})],
    [{workouts:[{...manual,completed_duration_min:null}]},'none',0],
    [{workouts:[{...manual,athlete_rpe:null}]},'manual_completions',computeActivityTrimp({moving_time:3600})],
    [{activities:[{...synced,moving_time:null}],interventions:[recovery]},'none',0],
    [{activities:[{...synced,average_heartrate:null}]},'synced_activities',computeActivityTrimp({moving_time:3600})],
  ];
  for(const [input,source,load]of cases){
    const metrics=buildLoadMetrics({...input,now});assert.equal(metrics.provenance.source,source);assert.equal(metrics.sparkline.at(-1).load,source==='none'?null:Number(load.toFixed(1)));
    if(source==='none'){assert.equal(metrics.acute,null);assert.equal(buildLoadStatus(metrics).tone,'neutral');}
    else {assert.ok(Number.isFinite(metrics.acute));assert.match(metrics.explainability,/Estimated/);}
  }
  const duplicate=buildLoadMetrics({activities:[synced,synced],now});assert.equal(duplicate.provenance.duplicate_activity_count,1);
  assert.equal(duplicate.sparkline.at(-1).load,Number(computeActivityTrimp(synced).toFixed(1)));
  const partial=buildLoadMetrics({workouts:[manual,{...manual,id:'missing',completed_duration_min:null}],now});assert.equal(partial.coverage,'partial');assert.match(partial.explainability,/without actual duration excluded/);
  assert.equal(buildLoadMetrics({workouts:[{...manual,status:'planned'}],now}).has_data,false);
});

test('real signed POST/calendar/me: accepted manual completion contributes and refresh updates; recovery and private drafts do not',async()=>{
  const f=await calendarFixture();try{
    const today=new Date().toISOString().slice(0,10);
    const before=await f.invoke('me');assert.equal(before.code,200,JSON.stringify(before.body));assert.equal(before.body.load_metrics.has_data,false);
    await f.pg.query('insert into interventions(athlete_id,date,intervention_type,dose_duration,subjective_feel) values($1,$2,$3,$4,$5)',[athlete,today,'Foam Rolling','30 min',6]);
    assert.equal((await f.invoke('me')).body.load_metrics.has_data,false);
    const created=await f.invoke('calendar',{method:'POST',body:{title:'Actual trail run',workout_date:today,status:'completed',completed_duration_min:60,completed_distance_km:10,athlete_rpe:6}});
    assert.equal(created.code,200,JSON.stringify(created.body));
    const after=await f.invoke('me');assert.equal(after.code,200);assert.equal(after.body.load_metrics.provenance.manual_count,1);assert.ok(after.body.load_metrics.acute>0);
    const id=created.body.workout.id;
    await f.pg.query('insert into strava_activities(id,athlete_id,strava_activity_id,start_date,local_date,moving_time,average_heartrate) values($1,$2,$3,$4,$5,$6,$7)',[activity,athlete,'synthetic-import',`${today}T09:00:00Z`,today,3600,140]);
    await f.pg.query('update planned_workouts set completed_activity_id=$1 where id=$2',[activity,id]);
    const matched=await f.invoke('me');assert.equal(matched.body.load_metrics.provenance.manual_count,0);assert.equal(matched.body.load_metrics.provenance.matched_plan_count,1);
    await f.pg.exec('reset role;alter table strava_activities rename to temporarily_unavailable;set role service_role;');
    assert.equal((await f.invoke('me')).code,503,'load query failure does not masquerade as no training');
  }finally{await f.close();}
});

test('inbox SQL excludes private thread title/comment/unread count before aggregation, including another linked coach',async()=>{
  const f=await messageFixture();try{
    await f.pg.exec(`reset role;alter table planned_workouts add column visibility text not null default 'athlete_visible',add column coach_id uuid;
      update planned_workouts set visibility='coach_private',coach_id='${messageCoach}';
      insert into workout_comments(athlete_id,planned_workout_id,sender_role,body) values('${messageAthlete}','${messagePlan}','coach','Private draft instructions');`);
    await f.pg.exec(`create schema auth;create function auth.uid() returns uuid language sql stable as 'select null::uuid';
      alter table athletes add column supabase_user_id uuid;`);
    await f.pg.exec(migration('20261010030000_private_workouts_and_week_copy.sql'));
    await f.pg.exec(migration('20261010030100_private_workout_inbox.sql'));
    await f.pg.exec(readFileSync(new URL('../scripts/calendar-gap-schema-preflight.sql',import.meta.url),'utf8'));
    await f.pg.exec('set role service_role;');
    const hidden=await f.invoke('center',{actor:messageAthlete});assert.equal(hidden.code,200,JSON.stringify(hidden.body));assert.deepEqual(hidden.body.workout_threads,[]);assert.equal(hidden.body.unread_total,0);
    const own=await f.invoke('center',{actor:messageOwner,query:{mode:'coach'}});assert.equal(own.body.workout_threads.length,1);
    assert.equal((await f.invoke('center',{actor:messageAthlete,method:'POST',body:{action:'mark_read',scope:'workout',workout_id:messagePlan}})).code,404);
    await f.pg.exec(`insert into coach_profiles(id,athlete_id,display_name) values('${otherCoach}','${messageStranger}','Second coach');
      insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${otherCoach}','${messageAthlete}','active');`);
    const other=await f.invoke('center',{actor:messageStranger,query:{mode:'coach'}});assert.deepEqual(other.body.workout_threads,[]);
    await f.pg.exec(`update planned_workouts set visibility='athlete_visible';`);
    const published=await f.invoke('center',{actor:messageAthlete});assert.equal(published.body.workout_threads.length,1);assert.equal(published.body.unread_total,1);
    await f.pg.exec(`reset role;`);
    const countBefore=(await f.pg.query('select count(*)::int n from planned_workouts')).rows[0].n;
    await f.pg.exec(readFileSync(new URL('../scripts/rollback-private-workouts-week-copy.sql',import.meta.url),'utf8'));
    assert.equal((await f.pg.query("select to_regprocedure('public.copy_planned_workout_week(uuid,uuid,uuid,date,date)') proc")).rows[0].proc,null);
    assert.equal((await f.pg.query('select count(*)::int n from planned_workouts')).rows[0].n,countBefore,'prepared rollback retains workouts');
    await assert.rejects(f.pg.exec(readFileSync(new URL('../scripts/calendar-gap-schema-preflight.sql',import.meta.url),'utf8')),/prerequisites missing/);
  }finally{await f.close();}
});
