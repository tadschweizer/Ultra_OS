import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture, owner, athlete, stranger, coach, plan, response } from './helpers/message-lifecycle-fixture.mjs';
import { createReadinessHandler } from '../pages/api/ready.js';
import { createCoachSharedDocsHandler } from '../pages/api/coach/shared-docs.js';
import { createAthleteSharedDocsHandler } from '../pages/api/athlete/shared-docs.js';
import { createCoachGroupsHandler } from '../pages/api/coach/groups.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { decideWorkoutMatch } from '../lib/workoutMatch.js';

test('hosted version conflicts use PT409 without the transient serialization retry code', async () => {
  const f=await fixture({releasePrerequisites:true});
  try {
    const body={mode:'coach',athlete_id:athlete,body:'Keep this draft'};
    const saved=await f.invoke('draft',{method:'PUT',body});
    assert.equal(saved.code,200);
    const stale=await f.invoke('draft',{method:'PUT',body:{...body,body:'Stale edit'}});
    assert.equal(stale.code,409);
    assert.equal((await f.invoke('draft',{query:{athlete_id:athlete}})).body.draft.body,'Keep this draft');
    assert.equal((await f.send()).code,200);
    assert.equal((await f.send(undefined,'coach','Changed retry')).code,409);
    const args={p_actor_id:athlete,p_workout_id:plan,p_action:'reject',p_activity_id:null,p_expected_updated_at:'2000-01-01T00:00:00Z'};
    await assert.rejects(f.rpc('decide_workout_activity_match',args),error=>error.code==='PT409');
    const result=await decideWorkoutMatch(f.admin,athlete,{id:plan,match_action:'reject',expected_updated_at:args.p_expected_updated_at});
    assert.equal(result.status,409);
    const definitions=(await f.pg.query(`select prosrc from pg_proc where proname in ('save_message_draft','send_direct_message','decide_workout_activity_match')`)).rows;
    assert.equal(definitions.length,3);
    for(const row of definitions){assert.ok(row.prosrc.includes('PT409'));assert.ok(!row.prosrc.includes('40001'));}
    assert.equal(await f.rpc('pilot_schema_readiness'),true);
  } finally {await f.close();}
});

test('exact prerequisite, workout and messaging migrations work together with native private grants', async () => {
  const f=await fixture({releasePrerequisites:true});
  try {
    assert.equal(f.prerequisiteGrants,true);
    assert.deepEqual(f.releaseStages,[false,false]);
    assert.equal(await f.rpc('pilot_schema_readiness'),true);
    assert.equal((await f.send()).code,200);
    assert.equal((await f.send('13300000-0000-4000-8000-000000000002','athlete','Reply')).code,200);
    assert.equal((await f.pg.query('select count(*)::int n from coach_notifications')).rows[0].n,1);
    const res=response();
    await createReadinessHandler({getClient:()=>({...f.admin,from:()=>({select:()=>({limit:async()=>({data:[]})})})}),alert(){}})({method:'GET'},res);
    assert.equal(res.code,200);
    assert.equal(res.body.checks.schema.status,'ok');
    const before=(await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n;
    for(let i=0;i<3;i++)assert.equal(await f.rpc('pilot_schema_readiness'),true);
    assert.equal((await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n,before);
  } finally {await f.close();}
});

test('schema readiness detects lost functions, client grants, RLS and unique match index', async () => {
  const f=await fixture({releasePrerequisites:true});
  try {
    for(const change of [
      'revoke execute on function public.send_direct_message(uuid,uuid,uuid,text,text,text,uuid) from service_role',
      'grant select on coach_shared_docs to authenticated',
      'revoke delete on coach_shared_docs from service_role',
      'alter table coach_messages disable row level security',
      'drop index planned_workouts_one_activity_per_athlete',
      'alter table athletes drop column email_verified_at',
      'alter table athletes drop column notification_preferences',
      'drop function public.finish_message_email(uuid,uuid,text,text,text)',
    ]) {
      await f.pg.exec('reset role;begin;');
      await f.pg.exec(change);
      await f.pg.exec('set role service_role;');
      assert.equal(await f.rpc('pilot_schema_readiness'),false,change);
      await f.pg.exec('rollback;set role service_role;');
      assert.equal(await f.rpc('pilot_schema_readiness'),true);
    }
    for(const role of ['anon','authenticated']) {
      await f.pg.exec(`reset role;set role ${role};`);
      await assert.rejects(f.pg.query('select public.pilot_schema_readiness()'),/permission denied/);
      await assert.rejects(f.pg.query('select * from coach_shared_docs'),/permission denied/);
      await assert.rejects(f.pg.query('select * from coach_messages'),/permission denied/);
    }
  } finally {await f.close();}
});

test('repair collision stops instead of rewriting existing message or document history', async () => {
  const f=await fixture({releasePrerequisites:true});
  try {
    await f.send();
    await f.pg.exec('reset role;');
    const source=readFileSync(new URL('../supabase/migrations/20261009201251_pilot_release_prerequisites.sql',import.meta.url),'utf8');
    await assert.rejects(f.pg.exec(source),/already exists/);
    await f.pg.exec('rollback;');
    assert.equal((await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n,1);
    assert.equal(await f.rpc('pilot_schema_readiness'),true);
  } finally {await f.close();}
});

test('operator preflight executes read-only after release and reports schema ready', async () => {
  const f=await fixture({releasePrerequisites:true});
  try {
    const source=readFileSync(new URL('../scripts/pilot-release-preflight.sql',import.meta.url),'utf8');
    const [before]=(await f.pg.query('select count(*)::int n from athletes')).rows;
    const result=(await f.pg.query(source)).rows[0].pilot_release_preflight;
    assert.equal(result.ready,true,JSON.stringify(result));
    assert.equal(result.repair_allowed,false);
    assert.equal(result.duplicate_activity_links,0);
    assert.equal((await f.pg.query('select count(*)::int n from athletes')).rows[0].n,before.n);
  } finally {await f.close();}
});

test('shared documents persist through coach/athlete handlers and revoke access with relationship/session', async () => {
  const f=await fixture({releasePrerequisites:true});
  const coachHandler=createCoachSharedDocsHandler({getClient:()=>f.admin});
  const athleteHandler=createAthleteSharedDocsHandler({getClient:()=>f.admin});
  const call=async(handler,actor,{method='GET',body={},query={},version=1}={})=>{
    const res=response();await handler({method,body,query,headers:{cookie:actor?`athlete_id=${signAthleteSession(actor,version)}`:''}},res);return res;
  };
  try {
    let r=await call(coachHandler,owner,{method:'POST',body:{athlete_id:athlete,title:'Normal recovery',doc_type:'text',content:'Coach-written guidance'}});
    assert.equal(r.code,200,JSON.stringify(r.body));const id=r.body.doc.id;
    r=await call(athleteHandler,athlete);assert.equal(r.body.docs[0].id,id);
    assert.equal(r.headers['Cache-Control'],'private, no-store');
    assert.deepEqual((await call(athleteHandler,stranger,{query:{athlete_id:athlete}})).body,{docs:[]});
    assert.equal((await call(athleteHandler,null)).code,401);
    await f.pg.exec(`update athletes set session_version=2 where id='${athlete}';`);
    assert.equal((await call(athleteHandler,athlete)).code,401);
    const before=(await f.pg.query('select updated_at from coach_shared_docs where id=$1',[id])).rows[0].updated_at;
    await f.pg.query('update coach_shared_docs set title=$2 where id=$1',[id,'Updated recovery']);
    assert.ok(new Date((await f.pg.query('select updated_at from coach_shared_docs where id=$1',[id])).rows[0].updated_at)>=new Date(before));
    await f.pg.exec("update coach_athlete_relationships set status='revoked';");
    assert.deepEqual((await call(athleteHandler,athlete,{version:2})).body,{docs:[]});
    assert.equal((await call(coachHandler,owner,{query:{athlete_id:athlete}})).code,403);
    assert.equal((await call(coachHandler,owner,{method:'DELETE',query:{id}})).code,403);
    assert.equal((await f.pg.query('select count(*)::int n from coach_shared_docs')).rows[0].n,1);
    await f.pg.exec("update coach_athlete_relationships set status='active';");
    assert.equal((await call(coachHandler,owner,{method:'DELETE',query:{id}})).code,200);
    assert.deepEqual((await call(athleteHandler,athlete,{version:2})).body,{docs:[]});
  } finally {await f.close();}
});

test('document dependency failures return retryable safe errors', async () => {
  for(const make of [createCoachSharedDocsHandler,createAthleteSharedDocsHandler]) {
    const res=response();
    await make({getClient(){throw new Error('private database hostname and service key');}})({method:'GET'},res);
    assert.equal(res.code,503);
    assert.equal(JSON.stringify(res.body).includes('private'),false);
    assert.match(res.body.error,/retry/i);
  }
});

test('group membership persists, retries without duplicates, and rejects foreign or revoked athletes', async () => {
  const f=await fixture({releasePrerequisites:true});
  try {
    const group='99999999-9999-4999-8999-999999999999';
    await f.pg.query('insert into coach_groups(id,coach_id,name) values($1,$2,$3)',[group,coach,'Normal training group']);
    const handler=createCoachGroupsHandler({getClient:()=>f.admin});
    const invoke=async(target=athlete,action='add')=>{
      const res=response();await handler({method:'PUT',body:{group_id:group,athlete_id:target,action},
        headers:{cookie:`athlete_id=${signAthleteSession(owner,1)}`}},res);return res;
    };
    assert.equal((await invoke()).code,200);
    assert.equal((await invoke()).code,200);
    assert.equal((await f.pg.query('select count(*)::int n from coach_group_members')).rows[0].n,1);
    assert.equal((await invoke(stranger)).code,400);
    await f.pg.exec("update coach_athlete_relationships set status='revoked';");
    assert.equal((await invoke()).code,400);
    await f.pg.exec("update coach_athlete_relationships set status='active';");
    assert.equal((await invoke(athlete,'remove')).code,200);
    assert.equal((await f.pg.query('select count(*)::int n from coach_group_members')).rows[0].n,0);
  } finally {await f.close();}
});
