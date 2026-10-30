import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {calendarFixture,migration,owner,athlete,coach,plan,activity,stranger,otherCoach} from './helpers/calendar-gap-fixture.mjs';
import {createWorkoutReviewHandler} from '../pages/api/workout-review.js';

async function fixture(){
  const f=await calendarFixture();
  await f.pg.exec('reset role');
  await f.pg.exec(migration('20261017003222_weekly_coaching_workflow.sql'));
  await f.pg.exec(migration('20261030150536_uploaded_workout_reviews.sql'));
  await f.pg.exec('set role service_role');
  await f.pg.query(`insert into strava_activities(id,athlete_id,strava_activity_id,name,sport_type,start_date,local_date,distance,moving_time)
    values($1,$2,'synthetic-upload','Unassigned swim','Swim','2026-10-30T01:00:00Z','2026-10-29',1500,1800)`,[activity,athlete]);
  f.handlers.review=createWorkoutReviewHandler({getAdmin:()=>f.admin});
  f.queue=async(actor=owner,page=0)=>f.invoke('review',{actor,query:{mode:'coach',page}});
  f.mark=async(revision,actor=owner)=>f.invoke('review',{actor,method:'POST',body:{activity_id:activity,action:'review',revision,request_id:randomUUID(),mode:'coach'}});
  return f;
}

test('all uploaded sports appear without a plan match, with local dates and matching counts',async()=>{
 const f=await fixture();try{
  const queue=await f.queue();assert.equal(queue.code,200,JSON.stringify(queue.body));
  const row=queue.body.items.find(x=>x.id===activity);
  assert.ok(row,'unassigned imported activity must appear');assert.equal(row.source_kind,'activity');
  assert.equal(row.workout_date,'2026-10-29');assert.equal(row.completed_duration_min,30);assert.equal(row.completed_distance_km,1.5);
  assert.match(row.review_revision,/^[a-f0-9]{32}$/);
  const counts=await f.admin.rpc('coaching_review_counts',{p_actor_id:owner});assert.equal(counts.error,undefined);
  assert.equal(counts.data[0].pending_reviews,1);
 }finally{await f.close();}
});

test('explicit upload review is persistent, idempotent, stale-safe and ignores unchanged resync timestamps',async()=>{
 const f=await fixture();try{
  const row=(await f.queue()).body.items[0];const before=(await f.pg.query('select * from strava_activities where id=$1',[activity])).rows[0];
  assert.equal((await f.mark(row.review_revision)).code,200);
  assert.equal((await f.queue()).body.items.length,0);
  const saved=(await f.pg.query('select * from uploaded_workout_coach_reviews')).rows[0];
  assert.equal((await f.mark(row.review_revision)).code,200);
  assert.deepEqual((await f.pg.query('select * from uploaded_workout_coach_reviews')).rows[0],saved,'retry must not rewrite review timestamp');
  assert.deepEqual((await f.pg.query('select * from strava_activities where id=$1',[activity])).rows[0],before,'review does not edit the recording');
  await f.pg.query('update strava_activities set updated_at=now(),synced_at=now() where id=$1',[activity]);
  assert.equal((await f.queue()).body.items.length,0,'routine sync does not reopen unchanged activity');
  await f.pg.query('update strava_activities set moving_time=1900 where id=$1',[activity]);
  assert.equal((await f.queue()).body.items.length,1,'changed result reopens review');
  assert.equal((await f.mark(row.review_revision)).code,409,'old snapshot cannot acknowledge new data');
  assert.equal((await f.mark((await f.queue()).body.items[0].review_revision)).code,200);
 }finally{await f.close();}
});

test('matched uploads appear once and retain the existing assigned-workout review lifecycle',async()=>{
 const f=await fixture();try{
  await f.pg.query("update planned_workouts set visibility='athlete_visible',completed_activity_id=$1 where id=$2",[activity,plan]);
  let queue=(await f.queue()).body.items;assert.equal(queue.length,1);assert.equal(queue[0].id,plan);assert.equal(queue[0].source_kind,'workout');
  const state=await f.invoke('review',{actor:owner,query:{workout_id:plan}});
  assert.equal((await f.invoke('review',{actor:owner,method:'POST',body:{workout_id:plan,action:'review',revision:state.body.revision,request_id:randomUUID()}})).code,200);
  assert.equal((await f.queue()).body.items.length,0,'reviewed matched upload is not duplicated as unassigned');
  await f.pg.query("update planned_workouts set visibility='coach_private' where id=$1",[plan]);
  assert.equal((await f.queue()).body.items[0].id,activity,'private plan cannot conceal a visible recording');
 }finally{await f.close();}
});

test('upload reviews require real active coach access, rechecked even for a retry; public roles are denied',async()=>{
 const f=await fixture();try{
  const revision=(await f.queue()).body.items[0].review_revision;
  assert.equal((await f.mark(revision,athlete)).code,403);
  assert.equal((await f.mark(revision,stranger)).code,403);
  await f.pg.query("update athletes set primary_role='coach',subscription_tier='coach_pro' where id=$1",[stranger]);
  await f.pg.query("insert into coach_athlete_relationships(coach_id,athlete_id,status,expires_at) values($1,$2,'active',now()-interval '1 day')",[otherCoach,athlete]);
  assert.equal((await f.queue(stranger)).body.items.length,0);
  assert.equal((await f.mark(revision,stranger)).code,403,'expired linked coach cannot acknowledge');
  await f.pg.query("update coach_athlete_relationships set expires_at=now()+interval '1 day' where coach_id=$1",[otherCoach]);
  assert.equal((await f.mark(revision,stranger)).code,200);
  assert.equal((await f.queue()).body.items.length,1,'one coach does not complete another coach review');
  assert.equal((await f.mark(revision)).code,200);
  await f.pg.query('update coach_athlete_relationships set removed_at=now() where coach_id=$1',[coach]);
  assert.equal((await f.mark(revision)).code,403,'retry after revocation is denied');
  assert.equal((await f.queue()).body.items.length,0);
  await f.pg.exec('reset role;set role authenticated');
  await assert.rejects(f.pg.query('select * from uploaded_workout_coach_reviews'),/permission denied/);
  await assert.rejects(f.pg.query('select coaching_uploaded_activity_review($1,$2,$3)',[owner,activity,revision]),/permission denied/);
  await assert.rejects(f.pg.query('select * from coaching_pending_review_items($1)',[owner]),/permission denied/);
  await f.pg.exec('reset role;set role anon');
  await assert.rejects(f.pg.query('select * from uploaded_workout_coach_reviews'),/permission denied/);
  await assert.rejects(f.pg.query('select coaching_review_queue($1)',[owner]),/permission denied/);
 }finally{await f.close();}
});

test('uploads are isolated per coach/athlete, undated uploads retained and pagination deterministic',async()=>{
 const f=await fixture();try{
  await f.pg.query("insert into strava_activities(athlete_id,strava_activity_id,name) values($1,'unrelated','Unrelated upload')",[stranger]);
  for(let i=0;i<52;i++)await f.pg.query("insert into strava_activities(athlete_id,strava_activity_id,name,local_date) values($1,$2,$3,'2026-10-29')",[athlete,`fixture-${i}`,`Uploaded ${i}`]);
  await f.pg.query("insert into strava_activities(athlete_id,strava_activity_id,name) values($1,'undated','Undated upload')",[athlete]);
  const a=(await f.queue()).body,b=(await f.queue(owner,1)).body;
  assert.equal(a.items.length,50);assert.equal(a.has_more,true);assert.equal(b.items.length,4);assert.equal(b.has_more,false);
  assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,54);
  assert.ok(b.items.some(x=>x.title==='Undated upload'&&x.workout_date===null));
  assert.ok([...a.items,...b.items].every(x=>x.athlete_id===athlete));
  assert.deepEqual((await f.queue()).body.items.map(x=>x.id),a.items.map(x=>x.id));
  const malformed=await f.invoke('review',{actor:owner,method:'POST',body:{activity_id:activity,workout_id:plan,action:'review',revision:'x',request_id:randomUUID()}});
  assert.equal(malformed.code,400);
 }finally{await f.close();}
});
