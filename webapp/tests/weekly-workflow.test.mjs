import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {readFileSync} from 'node:fs';
import {calendarFixture,migration,owner,athlete,coach,plan,library,stranger} from './helpers/calendar-gap-fixture.mjs';
import {createWeeklyPlanHandler} from '../pages/api/coach/weekly-plan.js';
import {createWorkoutReviewHandler} from '../pages/api/workout-review.js';
import {prescription,validateWeek,dateAfter} from '../lib/weeklyPlan.js';

async function fixture(){const f=await calendarFixture();await f.pg.exec('reset role');await f.pg.exec(migration('20261017003222_weekly_coaching_workflow.sql'));await f.pg.exec('set role service_role');
  f.handlers.week=createWeeklyPlanHandler({getAdmin:()=>f.admin});f.handlers.review=createWorkoutReviewHandler({getAdmin:()=>f.admin});return f;}
async function payload(f,target=athlete){const w=(await f.pg.query('select * from planned_workouts where id=$1',[plan])).rows[0];return {
  athlete_id:target,request_id:randomUUID(),week_start:'2026-10-19',occupied_ids:[],targets_confirmed:true,allow_occupied:false,
  entries:[{source_type:'workout',source_id:plan,source_updated_at:w.updated_at.toISOString(),prescription:{...prescription(w),planned_duration_min:60,planned_distance_km:8,planned_tss:65,planned_if:0.75,workout_date:'2026-10-19'}}]};}
test('weekly publication: five athletes, independent prescriptions, retry, occupancy and atomic failure',async()=>{
 const f=await fixture();try{
  const ids=[athlete,...Array.from({length:4},()=>randomUUID())];
  for(const id of ids.slice(1)){await f.pg.query('insert into athletes(id,name) values($1,$2)',[id,'Runner']);await f.pg.query("insert into coach_athlete_relationships(coach_id,athlete_id,status) values($1,$2,'active')",[coach,id]);}
  for(const [i,id]of ids.entries()){
    const body=await payload(f,id);body.entries[0].prescription.planned_duration_min=40+i;
    body.entries=Array.from({length:7},(_,day)=>({...body.entries[0],prescription:{...body.entries[0].prescription,workout_date:dateAfter(body.week_start,day)}}));
    const a=await f.invoke('week',{actor:owner,method:'POST',body});assert.equal(a.code,200,JSON.stringify(a.body));
    assert.equal(a.body.workout_ids.length,7);
    const replay=await f.invoke('week',{actor:owner,method:'POST',body});assert.deepEqual(replay.body.workout_ids,a.body.workout_ids);assert.equal(replay.body.replayed,true);
    const row=(await f.pg.query('select * from planned_workouts where id=$1',[a.body.workout_ids[0]])).rows[0];
    assert.equal(Number(row.planned_duration_min),40+i);assert.equal(row.status,'planned');assert.equal(row.athlete_comment,null);assert.equal(row.coach_feedback,null);assert.equal(row.completed_duration_min,null);assert.equal(row.visibility,'athlete_visible');
    const changed=structuredClone(body);changed.entries[0].prescription.title='Changed';assert.equal((await f.invoke('week',{actor:owner,method:'POST',body:changed})).code,409);
  }
  const body=await payload(f);assert.equal((await f.invoke('week',{actor:owner,method:'POST',body})).code,409,'stale destination');
  const occupied=(await f.pg.query("select id from planned_workouts where athlete_id=$1 and workout_date between '2026-10-19' and '2026-10-25'",[athlete])).rows.map(x=>x.id).sort();
  body.occupied_ids=occupied;assert.equal((await f.invoke('week',{actor:owner,method:'POST',body})).code,409,'occupied day requires consent');body.allow_occupied=true;
  body.entries.push({...body.entries[0],source_id:randomUUID()});assert.equal((await f.invoke('week',{actor:owner,method:'POST',body})).code,403);
  assert.equal(Number((await f.pg.query('select count(*) from workout_week_publications')).rows[0].count),5,'whole failing athlete rolled back');
  assert.equal(Number((await f.pg.query("select count(*) from planned_workouts where workout_date='2026-10-19'")).rows[0].count),5);
  body.entries.pop();assert.equal((await f.invoke('week',{actor:owner,method:'POST',body})).code,200);
 }finally{await f.close();}
});
test('weekly access: source ownership, revocation, private data and payload boundary',async()=>{
 const f=await fixture();try{
  const body=await payload(f);
  assert.equal((await f.invoke('week',{actor:stranger,method:'POST',body})).code,403);
  body.entries[0].prescription.athlete_comment='Must not copy';assert.match(validateWeek(body),/prescriptions/);delete body.entries[0].prescription.athlete_comment;
  await f.pg.query("update coach_athlete_relationships set status='removed' where coach_id=$1",[coach]);
  assert.equal((await f.invoke('week',{actor:owner,method:'POST',body})).code,403);
  await f.pg.exec('reset role;set role authenticated');
  await assert.rejects(f.pg.query('select * from workout_coach_reviews'),/permission denied/);
  await assert.rejects(f.pg.query('select publish_coaching_week($1,$2)',[owner,body]),/permission denied/);
 }finally{await f.close();}
});
test('review lifecycle: explicit request, no-change, reply once, reopen and stale revision',async()=>{
 const f=await fixture();try{
  await f.pg.query("update planned_workouts set visibility='athlete_visible' where id=$1",[plan]);
  const get=async()=>{const r=await f.invoke('review',{query:{workout_id:plan}});assert.equal(r.code,200,JSON.stringify(r.body));return r.body;};
  const act=async(actor,action,revision,extra={})=>f.invoke('review',{actor,method:'POST',body:{workout_id:plan,action,revision,request_id:randomUUID(),...extra}});
  let state=await get();assert.equal(state.reviewed,false);
  assert.equal((await act(athlete,'request',state.revision)).code,200);state=await get();assert.equal(state.request_open,true);
  assert.equal((await act(owner,'review',state.revision)).code,200);state=await get();assert.equal(state.reviewed,true);assert.equal(state.request_open,true);
  const body={workout_id:plan,action:'reply',revision:state.revision,request_id:randomUUID(),reply:'Keep tomorrow easy.'};
  const sent=await f.invoke('review',{actor:owner,method:'POST',body});assert.equal(sent.code,200,JSON.stringify(sent.body));
  assert.equal((await f.invoke('review',{actor:owner,method:'POST',body})).code,200);
  assert.equal(Number((await f.pg.query("select count(*) from workout_comments where sender_role='coach'")).rows[0].count),1);
  state=await get();assert.equal(state.request_open,false);
  await f.pg.query("update planned_workouts set title='Coach title change' where id=$1",[plan]);assert.equal((await get()).reviewed,true);
  await f.pg.query("update planned_workouts set athlete_comment='Actually felt tired' where id=$1",[plan]);
  assert.equal((await act(owner,'review',state.revision)).code,409);state=await get();assert.equal(state.reviewed,false);assert.equal(state.request_open,false,'a correction reopens review, not an already answered request');
  await f.pg.query("insert into workout_comments(planned_workout_id,athlete_id,sender_role,body) values($1,$2,'athlete','Question')",[plan,athlete]);
  assert.equal((await get()).revision,state.revision+1);
  const queue=await f.invoke('review',{actor:owner,query:{mode:'coach'}});assert.equal(queue.code,200);assert.equal(queue.body.items[0].id,plan);
  assert.equal((await act(stranger,'review',(await get()).revision)).code,403);
  await f.pg.query("update coach_athlete_relationships set status='removed' where coach_id=$1",[coach]);
  assert.equal((await f.invoke('review',{actor:owner,method:'POST',body})).code,403,'retry cannot bypass revoked relationship');
 }finally{await f.close();}
});
test('review fails closed for private/unassigned workouts and unavailable migration',async()=>{
 const f=await fixture();try{
  assert.equal((await f.invoke('review',{actor:owner,query:{workout_id:plan}})).code,403);
  const result=await f.invoke('review',{actor:athlete,query:{mode:'coach'}});assert.equal(result.code,403);
 }finally{await f.close();}
 const old=await calendarFixture();try{
  old.handlers.review=createWorkoutReviewHandler({getAdmin:()=>old.admin});
  assert.equal((await old.invoke('review',{actor:owner,query:{workout_id:plan}})).code,503);
 }finally{await old.close();}
});

test('source edits require a new preview; existing published snapshots remain stable',async()=>{
 const f=await fixture();try{
  const body=await payload(f);const before=await f.invoke('week',{actor:owner,method:'POST',body});assert.equal(before.code,200);
  await f.pg.query("update planned_workouts set title='Revised source',updated_at=updated_at+interval '1 second' where id=$1",[plan]);
  const next=structuredClone(body);next.request_id=randomUUID();next.athlete_id=athlete;next.week_start='2026-10-26';next.entries[0].prescription.workout_date='2026-10-26';
  assert.equal((await f.invoke('week',{actor:owner,method:'POST',body:next})).code,409);
  assert.equal((await f.pg.query('select title from planned_workouts where id=$1',[before.body.workout_ids[0]])).rows[0].title,'Trail climbs');
  await f.pg.query("update planned_workouts set visibility='athlete_visible' where id=$1",[plan]);
  const counts=await f.admin.rpc('coaching_review_counts',{p_actor_id:owner});assert.equal(counts.error,undefined);assert.equal(counts.data[0].pending_reviews,1);
 }finally{await f.close();}
});

test('release catalog checks, expired relationships and coach entitlement fail closed',async()=>{
 const f=await fixture();try{
  const checks=(await f.pg.query(readFileSync(new URL('../scripts/weekly-workflow-preflight.sql',import.meta.url),'utf8'))).rows[0].weekly_workflow;
  assert.equal(checks.completion_revision,true);assert.equal(checks.response_requested,true);assert.equal(checks.triggers,2);
  assert.equal(Object.keys(checks.tables).length,3);assert.equal(Object.keys(checks.functions).length,4);
  for(const flags of [...Object.values(checks.tables),...Object.values(checks.functions)])for(const flag of Object.values(flags))assert.equal(flag,true);
  const body=await payload(f);
  await f.pg.query("update coach_athlete_relationships set expires_at=now()-interval '1 day' where coach_id=$1",[coach]);
  assert.equal((await f.invoke('week',{actor:owner,method:'POST',body})).code,403);
  await f.pg.query('update coach_athlete_relationships set expires_at=null where coach_id=$1',[coach]);
  await f.pg.query("update athletes set subscription_tier='free' where id=$1",[owner]);
  assert.equal((await f.invoke('week',{actor:owner,method:'POST',body})).code,403);
  assert.equal((await f.invoke('review',{actor:owner,query:{mode:'coach'}})).code,403);
 }finally{await f.close();}
});
