import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLibraryPayload } from '../pages/api/workout-library.js';
import { libraryWorkoutPayload } from '../lib/libraryWorkoutPayload.js';
import { libraryFixture, metadataMigration, legacyId, foreignCoach } from './helpers/library-fixture.mjs';
import { owner, athlete, stranger, coach } from './helpers/message-lifecycle-fixture.mjs';

export const prescription = {
  title:'Trail uphill repeats',sport:'run',description:'Runnable climb',objective:'Steady climbing economy',
  coach_instructions:'Walk recoveries; stop if form fades',planned_if:0.82,planned_duration_min:58,
  planned_distance_km:9.656064,planned_distance_unit:'mi',planned_tss:74,target_metric:'heart_rate',visibility:'coach_private',
  structure:[{type:'work',repeat:4,duration_min:5,target_type:'heart_rate',target_min:150,target_max:160,target_units:'bpm',notes:'Keep shoulders relaxed'},
    {type:'recovery',repeat:4,duration_min:2,target_type:'pace',target_min:6,target_max:7,target_units:'min/km',notes:'Walk if needed'}],
};

test('shared production payload preserves separate prescription fields, units, null and zero',()=>{
  const payload=libraryWorkoutPayload(prescription);
  assert.equal(payload.name,prescription.title);assert.equal(payload.objective,prescription.objective);
  assert.equal(payload.coach_instructions,prescription.coach_instructions);assert.deepEqual(payload.structure,prescription.structure);
  assert.equal(payload.planned_distance_km,9.656064);assert.equal(payload.planned_distance_unit,'mi');
  assert.equal(payload.target_metric,'heart_rate');assert.equal(payload.visibility,'coach_private');
  const zero=libraryWorkoutPayload({...prescription,planned_if:0,planned_tss:0,planned_duration_min:'',planned_distance_km:null});
  assert.equal(zero.planned_if,0);assert.equal(zero.planned_tss,0);assert.equal(zero.planned_duration_min,null);assert.equal(zero.planned_distance_km,null);
});
test('validation rejects bad metadata and permits all real editor targets',()=>{
  for(const body of [null,[],{name:''},{name:123},{objective:123},{coach_instructions:'x'.repeat(10001)},
    {planned_if:-1},{planned_if:Infinity},{planned_if:NaN},{planned_if:'0.8'},{target_metric:null},{target_metric:'hr'},
    {visibility:'public'},{visibility:null},{planned_distance_unit:'yards'},{structure:[null]},{tags:[12]}]) {
    assert.throws(()=>normalizeLibraryPayload(body),{status:400});
  }
  for(const target_metric of ['duration','distance','tss','pace','heart_rate','power','rpe'])assert.equal(normalizeLibraryPayload({target_metric}).target_metric,target_metric);
  assert.deepEqual(normalizeLibraryPayload({objective:null,planned_if:'',planned_tss:0}),{objective:null,planned_if:null,planned_tss:0});
  assert.deepEqual(normalizeLibraryPayload({structure:prescription.structure}),{structure:prescription.structure});
  const explicit=normalizeLibraryPayload({name:'Zero',structure:prescription.structure,planned_duration_min:null,planned_distance_km:null,planned_tss:0},{create:true});
  assert.equal(explicit.planned_tss,0);assert.equal(explicit.planned_duration_min,null);assert.equal(explicit.planned_distance_km,null);
  assert.equal(normalizeLibraryPayload({name:'Derived',structure:prescription.structure},{create:true}).planned_duration_min,28);
});
test('exact additive migration preserves legacy rows, RLS and constraints, and can run twice',async()=>{
  const f=await libraryFixture();try{
    const legacy=(await f.invokeLibrary()).body.workouts[0];
    assert.equal(legacy.id,legacyId);assert.equal(legacy.objective,null);assert.equal(legacy.coach_instructions,null);
    assert.equal(legacy.planned_if,null);assert.equal(legacy.target_metric,'duration');assert.equal(legacy.visibility,'athlete_visible');
    await f.pg.exec('reset role;');await f.pg.exec(metadataMigration);
    assert.deepEqual((await f.pg.query("select policyname,qual,with_check from pg_policies where tablename='workout_library'")).rows,f.libraryPolicies);
    assert.equal((await f.pg.query("select relrowsecurity from pg_class where oid='workout_library'::regclass")).rows[0].relrowsecurity,true);
    for(const value of ["'-1'","'NaN'","'Infinity'","'-Infinity'"])await assert.rejects(f.pg.exec(`update workout_library set planned_if=${value} where id='${legacyId}'`),/check constraint/);
    await f.pg.exec(`update workout_library set planned_if=0 where id='${legacyId}'; update workout_library set planned_if=null where id='${legacyId}';`);
    await assert.rejects(f.pg.exec(`update workout_library set visibility='public'`),/check constraint/);
    await assert.rejects(f.pg.exec(`update workout_library set target_metric=null`),/not-null constraint/);
  }finally{await f.close();}
});
test('real signed endpoint saves/reloads/patches metadata, filters ownership and denies unauthorized writes',async()=>{
  const f=await libraryFixture();try{
    assert.equal((await f.invokeLibrary({actor:null})).code,401);
    assert.equal((await f.invokeLibrary({version:0})).code,401);
    assert.equal((await f.invokeLibrary({actor:athlete})).code,403);
    for(const method of ['POST','PATCH','DELETE'])assert.equal((await f.invokeLibrary({method,origin:'https://evil.example',body:libraryWorkoutPayload(prescription)})).code,403);
    assert.equal((await f.invokeLibrary({method:'POST',contentType:'text/plain',body:{name:'No'}})).code,415);
    const created=await f.invokeLibrary({method:'POST',body:{...libraryWorkoutPayload(prescription),coach_id:foreignCoach}});
    assert.equal(created.code,200,JSON.stringify(created.body));const id=created.body.workout.id;
    assert.equal(created.body.workout.coach_id,coach);assert.deepEqual(created.body.workout.structure,prescription.structure);
    const reloaded=(await f.invokeLibrary()).body.workouts.find(w=>w.id===id);
    // PGlite returns PostgreSQL numeric as strings; PostgREST serializes them as JSON numbers.
    for(const field of ['objective','coach_instructions','target_metric','visibility','planned_distance_unit'])assert.equal(reloaded[field],prescription[field]);
    for(const field of ['planned_if','planned_tss','planned_distance_km'])assert.equal(Number(reloaded[field]),prescription[field]);
    assert.deepEqual((await f.invokeLibrary({actor:stranger})).body.workouts,[]);
    for(const method of ['PATCH','DELETE'])assert.equal((await f.invokeLibrary({actor:stranger,method,body:{id,name:'Stolen'},query:{id}})).code,404);
    const renamed=await f.invokeLibrary({method:'PATCH',body:{id,name:'Revised title',structure:[]}});
    assert.equal(renamed.code,200);assert.equal(Number(renamed.body.workout.planned_tss),74);assert.equal(renamed.body.workout.objective,prescription.objective);
    const cleared=await f.invokeLibrary({method:'PATCH',body:{id,objective:null,coach_instructions:null,planned_if:0,planned_tss:null}});
    assert.equal(cleared.body.workout.objective,null);assert.equal(cleared.body.workout.coach_instructions,null);assert.equal(Number(cleared.body.workout.planned_if),0);assert.equal(cleared.body.workout.planned_tss,null);
    assert.equal((await f.invokeLibrary({method:'PATCH',body:{id,planned_if:-1}})).code,400);
    assert.equal((await f.invokeLibrary({method:'PATCH',body:{id:'bad'}})).code,400);
    assert.equal((await f.invokeLibrary({method:'DELETE',query:{id}})).code,200);
    assert.equal((await f.invokeLibrary({method:'DELETE',query:{id}})).code,404);
    assert.equal((await f.invokeLibrary({method:'PUT'})).code,405);
  }finally{await f.close();}
});
test('unavailable metadata schema returns truthful service failure without leaking database internals',async()=>{
  const f=await libraryFixture();try{
    await f.pg.exec('reset role; alter table workout_library drop column objective; set role service_role;');
    const result=await f.invokeLibrary();assert.equal(result.code,503);assert.match(result.body.error,/not confirmed/);assert.doesNotMatch(result.body.error,/column|SQL/);
  }finally{await f.close();}
});
