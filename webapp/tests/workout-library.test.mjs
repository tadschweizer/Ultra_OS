import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { normalizeLibraryPayload } from '../pages/api/workout-library.js';
import { libraryWorkoutPayload } from '../lib/libraryWorkoutPayload.js';
import { libraryEditPayload, libraryCanonicalDistance, libraryDisplayDistance } from '../lib/libraryEditPayload.js';
import { libraryFixture, metadataMigration, createMigration, legacyId, foreignCoach } from './helpers/library-fixture.mjs';
import { readLibraryCreate, prepareLibraryCreate, confirmLibraryCreate, libraryCreateStorageKey } from '../lib/libraryCreateOperation.js';
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
test('template PATCH preserves omissions, nulls, zeroes, exact canonical distance and opaque steps',()=>{
  const form={...prescription,id:randomUUID(),description:null,planned_if:0,planned_tss:0,tags:null,planned_distance:'6'};
  assert.deepEqual(libraryEditPayload(form,new Set()),{id:form.id});
  assert.deepEqual(libraryEditPayload(form,new Set(['title','coach_instructions'])),{id:form.id,name:form.title,coach_instructions:form.coach_instructions});
  assert.deepEqual(libraryEditPayload({...form,planned_distance_unit:'km'},new Set(['planned_distance_unit'])),{id:form.id,planned_distance_unit:'km'});
  const changed=libraryEditPayload({...form,planned_duration_min:'',planned_if:'0',planned_tss:'',objective:'',planned_distance:'6'},
    new Set(['planned_duration_min','planned_if','planned_tss','objective','planned_distance','structure','tags']));
  assert.equal(changed.planned_duration_min,null);assert.equal(changed.planned_if,0);assert.equal(changed.planned_tss,null);
  assert.equal(changed.objective,null);assert.equal(changed.planned_distance_km,9.656064);assert.equal(changed.tags,null);
  assert.deepEqual(changed.structure,prescription.structure);
  assert.equal(libraryDisplayDistance(9.656064,'mi'),'6');assert.equal(libraryDisplayDistance(null,'mi'),'');
  assert.equal(libraryCanonicalDistance(libraryDisplayDistance(9.656064,'km'),'km'),9.656064);
  assert.equal(libraryCanonicalDistance('','km'),null);assert.equal(libraryCanonicalDistance('0','mi'),0);
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
    const created=await f.invokeLibrary({method:'POST',body:{...libraryWorkoutPayload(prescription),client_request_id:randomUUID(),coach_id:foreignCoach}});
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
test('signed library fixture uses the active isolated deployment origin regardless of other fixture import order',async()=>{
  const previous=process.env.NEXT_PUBLIC_SITE_URL;process.env.NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3000';
  const f=await libraryFixture();try{
    assert.equal((await f.invokeLibrary({method:'POST',body:{name:'Correct test origin',client_request_id:randomUUID()}})).code,200);
    assert.equal((await f.invokeLibrary({method:'POST',origin:'https://other.example',body:{name:'Wrong origin'}})).code,403);
  }finally{process.env.NEXT_PUBLIC_SITE_URL=previous;await f.close();}
});

test('F7 signed create retries replay one durable coach-scoped receipt and reject changed intent',async()=>{
  const f=await libraryFixture();try{
    const client_request_id=randomUUID(),body={...libraryWorkoutPayload(prescription),client_request_id};
    const first=await f.invokeLibrary({method:'POST',body});assert.equal(first.code,200,JSON.stringify(first.body));
    const replay=await f.invokeLibrary({method:'POST',body});assert.equal(replay.code,200);
    assert.equal(replay.body.workout.id,first.body.workout.id);assert.equal(replay.body.replayed,true);
    const reordered=await f.invokeLibrary({method:'POST',body:{...body,structure:body.structure.map(step=>Object.fromEntries(Object.entries(step).reverse()))}});
    assert.equal(reordered.body.workout.id,first.body.workout.id);
    const receipt=(await f.pg.query('select * from workout_library_create_requests')).rows[0];
    assert.match(receipt.payload_hash,/^[0-9a-f]{64}$/);assert.equal(Object.hasOwn(receipt,'payload'),false);
    assert.equal((await f.invokeLibrary()).body.workouts.length,2);
    assert.equal((await f.invokeLibrary({method:'POST',body:{...body,objective:'Changed intent'}})).code,409);
    const intentional=await f.invokeLibrary({method:'POST',body:{...body,client_request_id:randomUUID()}});
    assert.equal(intentional.code,200);assert.notEqual(intentional.body.workout.id,first.body.workout.id);
    const other=await f.invokeLibrary({actor:stranger,method:'POST',body});
    assert.equal(other.code,200);assert.equal(other.body.workout.coach_id,foreignCoach);assert.notEqual(other.body.workout.id,first.body.workout.id);
    // Editing cannot alter the immutable original intent or duplicate on replay.
    await f.invokeLibrary({method:'PATCH',body:{id:first.body.workout.id,name:'Edited template'}});
    const afterEdit=await f.invokeLibrary({method:'POST',body});assert.equal(afterEdit.body.workout.name,'Edited template');
    await f.invokeLibrary({method:'DELETE',query:{id:first.body.workout.id}});
    assert.equal((await f.invokeLibrary({method:'POST',body})).code,410);
    for(const key of [undefined,null,'bad'])assert.equal((await f.invokeLibrary({method:'POST',body:{name:'Invalid key',client_request_id:key}})).code,400);
  }finally{await f.close();}
});

test('create receipt migration is repeatable, service-only, atomic on failure and safe for overlapping retries',async()=>{
  const f=await libraryFixture();try{
    await f.pg.exec('reset role;');await f.pg.exec(createMigration);
    assert.equal((await f.pg.query("select relrowsecurity from pg_class where oid='workout_library_create_requests'::regclass")).rows[0].relrowsecurity,true);
    for(const role of ['anon','authenticated']) {
      assert.equal((await f.pg.query(`select has_table_privilege('${role}','workout_library_create_requests','select') as allowed`)).rows[0].allowed,false);
      assert.equal((await f.pg.query(`select has_function_privilege('${role}','create_workout_library_once(uuid,uuid,jsonb)','execute') as allowed`)).rows[0].allowed,false);
      await f.pg.exec(`set role ${role};`);
      await assert.rejects(f.pg.query('select * from workout_library_create_requests'),/permission denied/);
      await assert.rejects(f.pg.query('select create_workout_library_once($1,$2,$3)',[coach,randomUUID(),{name:'Spoofed'}]),/permission denied/);
      await f.pg.exec('reset role;');
    }
    assert.equal((await f.pg.query("select prosecdef from pg_proc where proname='create_workout_library_once'")).rows[0].prosecdef,false);
    const body={name:'Atomic trail create',client_request_id:randomUUID()};
    await f.pg.exec('alter table workout_library rename column objective to unavailable_objective; set role service_role;');
    assert.equal((await f.invokeLibrary({method:'POST',body})).code,503);
    assert.equal((await f.pg.query('select count(*)::int as n from workout_library_create_requests')).rows[0].n,0);
    await f.pg.exec('reset role; alter table workout_library rename column unavailable_objective to objective; set role service_role;');
    const retries=await Promise.all([f.invokeLibrary({method:'POST',body}),f.invokeLibrary({method:'POST',body})]);
    assert.deepEqual(retries.map(r=>r.code),[200,200]);assert.equal(retries[0].body.workout.id,retries[1].body.workout.id);
    assert.equal((await f.pg.query('select count(*)::int as n from workout_library_create_requests')).rows[0].n,1);
    assert.equal((await f.invokeLibrary()).body.workouts.length,2);
  }finally{await f.close();}
});

test('unconfirmed browser operations survive reload, reject changed intent and stay scoped to a coach',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const payload=libraryWorkoutPayload(prescription),first=prepareLibraryCreate(storage,coach,payload,randomUUID);
  assert.equal(readLibraryCreate(storage,coach).id,first.id);
  assert.equal(prepareLibraryCreate(storage,coach,{...payload,structure:payload.structure.map(step=>Object.fromEntries(Object.entries(step).reverse()))},randomUUID).id,first.id);
  assert.throws(()=>prepareLibraryCreate(storage,coach,{...payload,name:'Different intent'},randomUUID),/Retry the unconfirmed/);
  const other=prepareLibraryCreate(storage,foreignCoach,payload,randomUUID);assert.notEqual(other.id,first.id);
  confirmLibraryCreate(storage,coach,randomUUID());assert.equal(readLibraryCreate(storage,coach).id,first.id);
  confirmLibraryCreate(storage,coach,first.id);assert.equal(readLibraryCreate(storage,coach),null);
  assert.notEqual(prepareLibraryCreate(storage,coach,payload,randomUUID).id,first.id);
  values.set(libraryCreateStorageKey(coach),'broken');assert.throws(()=>prepareLibraryCreate(storage,coach,payload,randomUUID));
  assert.throws(()=>prepareLibraryCreate({...storage,setItem:()=>{throw new Error('Storage unavailable');}},'new-coach',payload,randomUUID),/Storage unavailable/);
});
