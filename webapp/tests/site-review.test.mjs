import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createSiteReviewHandler } from '../pages/api/site-review.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
process.env.SESSION_COOKIE_SECRET = 'review-tests-only-secret-with-at-least-32-characters';
const owner = '11111111-1111-4111-8111-111111111111';
const beth = '22222222-2222-4222-8222-222222222222';
const other = '44444444-4444-4444-8444-444444444444';
const id = '33333333-3333-4333-8333-333333333333';
let pg;
before(async()=>{
  pg=new PGlite();
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls; create table athletes(id uuid primary key,session_version integer default 1); grant select on athletes to service_role;');
  await pg.exec(readFileSync(new URL('../supabase/migrations/20261016195233_private_site_review.sql',import.meta.url),'utf8'));
  await pg.exec(`insert into athletes(id) values('${owner}'),('${beth}'),('${other}'); insert into site_reviewers values('${owner}'); insert into site_review_notes(id,athlete_id,pathname,note,status) values('${id}','${owner}','/','Old note','resolved');`);
  await pg.exec(readFileSync(new URL('../supabase/migrations/20261027190238_feedback_review_workflow.sql',import.meta.url),'utf8'));
  const legacy=(await pg.query('select * from site_review_notes')).rows[0];
  assert.equal(legacy.status,'completed');assert.equal(legacy.approved_by,null);
  assert.match((await pg.query('select message from site_review_events')).rows[0].message,/prior approval history is unavailable/);
  assert.equal((await pg.query('select role from site_reviewers')).rows[0].role,'contributor');
  await pg.exec(`update site_reviewers set role='owner',display_name='Tad' where athlete_id='${owner}'; insert into site_reviewers(athlete_id,display_name) values('${beth}','Beth');`);
});
after(async()=>pg?.close());
beforeEach(async()=>{await pg.exec('reset role; truncate site_review_notes cascade; update athletes set session_version=1;');});
function fixture(actor=owner, version=1) {
  const calls=[];
  const client={from(table){
    calls.push(table);const filters=[];const values=[];let fields,insert,update;
    const q={select(v){fields=v;return this;},upsert(v){insert=v;return this;},update(v){update=v;return this;},eq(k,v){filters.push(`${k}=$${values.push(v)}`);return this;},order(){return this;},limit(){return this;},
      async execute(single){
        try {if(insert){await pg.query("insert into site_review_notes(id,athlete_id,pathname,element,viewport,note) values($1,$2,$3,$4,$5,$6) on conflict(id) do nothing",[insert.id,insert.athlete_id,insert.pathname,insert.element,insert.viewport,insert.note]);return {data:null};} if(update){const result=await pg.query("update site_review_notes set status=$1 where id=$2 and athlete_id=$3 returning *",[update.status,...values]);return {data:result.rows[0]||null};} const result=await pg.query(`select ${table === "site_reviewers" ? fields : "*"} from ${table}${filters.length?' where '+filters.join(' and '):''}`,values);return {data:single?result.rows[0]||null:result.rows};}catch(error){return {error};}
      },maybeSingle(){return this.execute(true);},then(resolve,reject){return this.execute(false).then(resolve,reject);}};return q;
  },async rpc(name,args){
    calls.push(name);
    try {const result=await pg.query('select * from write_site_review($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[args.p_actor,args.p_id,args.p_request,args.p_action,args.p_version,args.p_status,args.p_message,args.p_path,args.p_element,args.p_viewport]);return {data:result.rows[0]};}catch(error){return {error};}
  }};
  const handler=createSiteReviewHandler({getClient:()=>client});
  return {calls,async invoke(method='GET',body={},headers={},query={}){
    const res={code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    if(version!==1) await pg.query('update athletes set session_version=$1 where id=$2',[version,actor]);
    await handler({method,query,body,headers:{cookie:actor?`athlete_id=${signAthleteSession(actor)}`:'',host:'localhost','content-type':'application/json',...headers}},res);return res;
  }};
}
const submission={id,pathname:'/calendar',element:'Save button',note:'Save failed'};
const transition=(version,status)=>({id,requestId:randomUUID(),version,action:'transition',status,message:''});
for(const method of ['GET','POST','PATCH']) test(`${method}: anonymous, non-members and revoked sessions denied before tasks`,async()=>{
  for(const [actor,version,code] of [[null,1,401],[other,1,403],[owner,2,401]]){
    const f=fixture(actor,version);assert.equal((await f.invoke(method,submission)).code,code);assert.ok(!f.calls.includes('site_review_notes'));assert.ok(!f.calls.includes('write_site_review'));
  }
});
test('submitter is session identity; identical retries create one task and one event',async()=>{
  const f=fixture(beth);
  for(let i=0;i<2;i++) assert.equal((await f.invoke('POST',{...submission,athlete_id:owner,status:'completed',approved_by:beth})).code,200);
  const tasks=(await f.invoke()).body.notes;assert.equal(tasks.length,1);assert.equal(tasks[0].athlete_id,beth);assert.equal(tasks[0].status,'pending_review');assert.equal(tasks[0].approved_by,null);
  assert.equal((await pg.query('select * from site_review_events')).rows.length,1);
  assert.equal((await f.invoke('POST',{...submission,note:'Changed retry'})).code,409);
  assert.equal((await f.invoke('POST',submission)).code,200);assert.equal((await pg.query('select * from site_review_notes')).rows.length,1);assert.equal((await pg.query('select * from site_review_events')).rows.length,1);
});
test('owner sees all, Beth only own; arbitrary IDs and body claims cannot grant access',async()=>{
  await fixture(owner).invoke('POST',submission);
  await fixture(beth).invoke('POST',{...submission,id:randomUUID()});
  assert.equal((await fixture(owner).invoke()).body.notes.length,2);
  assert.equal((await fixture(beth).invoke()).body.notes.length,1);
  assert.equal((await fixture(beth).invoke('GET',{}, {},{access:'1'})).body.canManage,false);
  assert.equal((await fixture(beth).invoke('PATCH',{id,requestId:randomUUID(),version:1,action:'update',message:'Intrude',p_actor:owner})).code,403);
  assert.equal((await fixture(beth).invoke('POST',submission)).code,403);
});
test('only owner advances stages; no skipped approval or completion; acceptance and actors recorded',async()=>{
  await fixture(beth).invoke('POST',submission);
  for(const status of ['approved','in_progress','awaiting_acceptance','completed']) assert.equal((await fixture(beth).invoke('PATCH',transition(1,status))).code,403);
  assert.equal((await fixture(owner).invoke('PATCH',transition(1,'completed'))).code,400);
  let version=1;
  for(const status of ['approved','in_progress','awaiting_acceptance','completed']){
    const response=await fixture(owner).invoke('PATCH',transition(version++,status));assert.equal(response.code,200,JSON.stringify(response.body));assert.equal(response.body.note.status,status);
  }
  const task=(await fixture(owner).invoke()).body.notes[0];assert.equal(task.approved_by,owner);assert.equal(task.completed_by,owner);assert.ok(task.approved_at);assert.ok(task.completed_at);
  assert.equal((await pg.query('select * from site_review_events')).rows.length,5);
});
test('updates persist and retry atomically; stale changes rejected without history or status mutation',async()=>{
  await fixture(beth).invoke('POST',submission);
  const update={id,requestId:randomUUID(),version:1,action:'update',message:'More detail'};
  for(let i=0;i<2;i++) assert.equal((await fixture(beth).invoke('PATCH',update)).code,200);
  assert.equal((await fixture(owner).invoke('PATCH',transition(1,'approved'))).code,409);
  assert.equal((await pg.query('select * from site_review_events')).rows.length,2);
  const task=(await fixture(beth).invoke()).body.notes[0];assert.equal(task.status,'pending_review');assert.equal(task.version,2);
});
test('reject malformed content, unsafe paths, origin and old resolve action',async()=>{
  const f=fixture();
  for(const body of [{...submission,note:''},{...submission,note:'x'.repeat(5001)},{...submission,pathname:'//evil.test'},{...submission,pathname:'/auth?token=secret'},{...submission,pathname:'https://evil.test'},{...submission,id:'bad'}]) assert.equal((await f.invoke('POST',body)).code,400);
  for(const headers of [{'content-type':'text/plain'},{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'}]) assert.equal((await f.invoke('POST',submission,headers)).code,403);
  assert.equal((await f.invoke('PATCH',{id,status:'resolved'})).code,400);assert.equal((await f.invoke('DELETE')).code,405);
});
test('database API cannot bypass membership, transitions, RLS or event immutability',async()=>{
  const signature='public.write_site_review(uuid,uuid,uuid,text,integer,text,text,text,text,text)';
  for(const role of ['anon','authenticated']){
    await pg.exec(`set role ${role}`);
    for(const table of ['site_reviewers','site_review_notes','site_review_events']) await assert.rejects(pg.query(`select * from ${table}`),/permission denied/);
    await assert.rejects(pg.query(`select write_site_review('${owner}','${id}','${id}','submit',null,null,'hello','/',null,null)`),/permission denied/);
    await pg.exec('reset role');
    assert.equal((await pg.query('select has_function_privilege($1,$2,$3) as ok',[role,signature,'EXECUTE'])).rows[0].ok,false);
  }
  await pg.exec('set role service_role');
  await assert.rejects(pg.query(`select write_site_review('${other}','${id}','${id}','submit',null,null,'hello','/',null,null)`),/Not permitted/);
  await fixture(beth).invoke('POST',submission);
  await assert.rejects(pg.query(`select write_site_review('${beth}','${id}','${randomUUID()}','transition',1,'approved','','',null,null)`),/Owner required/);
  await assert.rejects(pg.query("update site_review_events set message='tamper'"),/permission denied/);
  await pg.exec('reset role');
  assert.equal((await pg.query("select count(*)::int n from pg_class where relname in ('site_reviewers','site_review_notes','site_review_events') and relrowsecurity")).rows[0].n,3);
});
test('reopening returns to review and clears current approval without erasing history',async()=>{
  await fixture(beth).invoke('POST',submission);
  let version=1;
  for(const status of ['approved','in_progress','awaiting_acceptance','completed','pending_review']) assert.equal((await fixture(owner).invoke('PATCH',transition(version++,status))).code,200);
  const task=(await fixture(owner).invoke()).body.notes[0];assert.equal(task.status,'pending_review');assert.equal(task.approved_by,null);assert.equal(task.completed_by,null);
  assert.equal((await fixture(owner).invoke('PATCH',transition(6,'in_progress'))).code,400);
  assert.equal((await pg.query('select * from site_review_events')).rows.length,6);
});
test('history failure rolls back submission so task and event cannot diverge',async()=>{
  await pg.exec("create function fail_event() returns trigger language plpgsql as $$ begin raise exception 'simulated history failure'; end $$; create trigger reject_event before insert on site_review_events for each row execute function fail_event();");
  try {
    assert.equal((await fixture(beth).invoke('POST',submission)).code,503);
    assert.equal((await pg.query('select * from site_review_notes')).rows.length,0);
  } finally { await pg.exec('drop trigger reject_event on site_review_events; drop function fail_event();'); }
});
test('review-only provisioning requires the corrected exact verified identity and never grants a lookalike',async()=>{
  await pg.exec(`create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); alter table athletes add column supabase_user_id uuid; alter table athletes add column is_admin boolean default false; update athletes set supabase_user_id=id; update athletes set is_admin=true where id='${owner}'; insert into auth.users values('${owner}','tadschweizer@gmail.com',now()),('${beth}','bethschweizer@gmail.com',null),('${other}','beth.lookalike@example.invalid',now()); update site_reviewers set role='contributor'; delete from site_reviewers where athlete_id='${beth}';`);
  const script=readFileSync(new URL('../scripts/feedback-review-access.sql',import.meta.url),'utf8');
  await assert.rejects(pg.exec(script),/Exact verified Beth identity is missing/);await pg.exec('rollback');
  assert.equal((await pg.query("select role from site_reviewers where athlete_id=$1",[owner])).rows[0].role,'contributor');
  assert.equal((await pg.query("select * from site_reviewers where athlete_id=$1",[beth])).rows.length,0);
  await pg.query('update auth.users set email_confirmed_at=now() where id=$1',[beth]);await pg.exec(script);
  assert.equal((await pg.query('select role from site_reviewers where athlete_id=$1',[beth])).rows[0].role,'contributor');
  assert.equal((await pg.query('select * from site_reviewers where athlete_id=$1',[other])).rows.length,0);
});

test('pre-migration schema retains existing reviewer button, private notes and retry-safe saves without new grants',async()=>{
  const modern=pg;pg=new PGlite();
  try {
    await pg.exec('create role anon; create role authenticated; create role service_role bypassrls; create table athletes(id uuid primary key,session_version integer default 1);');
    await pg.exec(readFileSync(new URL('../supabase/migrations/20261016195233_private_site_review.sql',import.meta.url),'utf8'));
    await pg.exec(`insert into athletes(id) values('${owner}'),('${beth}'),('${other}'); insert into site_reviewers values('${owner}'),('${beth}');`);
    const access=await fixture(owner).invoke('GET',{}, {},{access:'1'});assert.equal(access.code,200);assert.equal(access.body.enabled,true);assert.equal(access.body.legacy,true);assert.equal(access.body.canManage,false);
    for(let i=0;i<2;i++) assert.equal((await fixture(owner).invoke('POST',submission)).code,200);
    assert.equal((await fixture(owner).invoke('POST',{...submission,note:'Changed replay'})).code,409);
    assert.equal((await fixture(owner).invoke('POST',submission)).code,200);
    assert.equal((await fixture(owner).invoke()).body.notes.length,1);assert.equal((await fixture(beth).invoke()).body.notes.length,0);
    assert.equal((await fixture(other).invoke()).code,403);
    assert.equal((await fixture(beth).invoke('PATCH',{id,status:'resolved'})).code,404);
    assert.equal((await fixture(owner).invoke('PATCH',{id,status:'resolved'})).code,200);
    assert.equal((await fixture(owner).invoke('PATCH',transition(1,'approved'))).code,400);
    assert.equal((await pg.query('select * from site_review_notes')).rows.length,1);
    assert.equal((await pg.query('select * from site_reviewers')).rows.length,2);
  } finally {await pg.close();pg=modern;}
});
