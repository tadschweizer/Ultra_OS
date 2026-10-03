import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { getRecentActivities } from '../lib/strava.js';
import { toActivityRow, createActivitySync } from '../lib/activitySync.js';
import { classifyStravaSyncError, publicStravaSyncStatus } from '../lib/stravaSyncStatus.js';
import { createStravaConnectionHandler } from '../pages/api/strava/connection.js';
import { createStravaWebhookHandler } from '../pages/api/strava/webhook/[token].js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { createOAuthState } from '../lib/auth/oauthState.js';
import { createStravaCallbackHandler } from '../pages/api/strava/callback.js';
import { createStravaRefreshHandler } from '../pages/api/strava/refresh-pending.js';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const migration = readFileSync(new URL('../supabase/migrations/20261003231047_strava_import_lifecycle.sql', import.meta.url), 'utf8');
const prerequisite = readFileSync(new URL('../supabase/migrations/20260725000000_activity_sync_persistence.sql', import.meta.url), 'utf8');
const sample = (id = 123) => ({ id, name: 'Evening training', sport_type: 'Run', start_date: '2026-10-03T01:00:00Z',
  start_date_local: '2026-10-02T19:00:00Z', moving_time: 3600 });
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table public.athletes(id uuid primary key,strava_id text unique,access_token text,refresh_token text,token_expires_at timestamptz);
    create function public.is_current_athlete(uuid) returns boolean language sql as 'select false';
    insert into public.athletes values('${owner}','100','private-access','private-refresh',now()+interval '1 day'),('${other}','200',null,null,null);`);
  await db.exec(prerequisite); await db.exec(migration);
  await db.exec(`grant select,update on public.athletes to service_role;grant select,insert,update,delete on public.strava_activities to service_role;
    create table public.workout_comments(id uuid primary key default gen_random_uuid(),activity_id uuid references public.strava_activities(id) on delete cascade,body text);`);
  return db;
}
const claim = async db => (await db.query('select public.claim_strava_sync($1,$2,true,false) as result', [owner, '100'])).rows[0].result;
const finish = (db, lease, rows = [toActivityRow(owner, sample())]) => db.query(
  'select public.finish_strava_sync($1,$2,$3,$4,true) as result', [owner, '100', lease.lease_token, JSON.stringify(rows)]);

test('SQL import is exclusive, idempotent and atomically stamps successful history', async () => {
  const db = await database(); try {
    const lease = await claim(db); assert.ok(lease.lease_token);
    assert.equal((await claim(db)).reason, 'in_progress');
    assert.equal((await finish(db, lease)).rows[0].result.synced, 1);
    assert.equal((await db.query('select local_date::text from public.strava_activities')).rows[0].local_date, '2026-10-02');
    const stamp = (await db.query('select * from public.athletes where id=$1', [owner])).rows[0];
    assert.ok(stamp.last_activity_sync_at); assert.ok(stamp.activity_backfill_completed_at);
    await db.query("update strava_private.sync_state set last_attempt_at=now()-interval '1 minute'");
    await finish(db, await claim(db), [toActivityRow(owner, { ...sample(), name: 'Updated title' })]);
    assert.equal((await db.query('select count(*)::int as n from public.strava_activities')).rows[0].n, 1);
    assert.equal((await db.query('select name from public.strava_activities')).rows[0].name, 'Updated title');
  } finally { await db.close(); }
});
test('SQL foreign-owner batch rolls back activity writes and successful stamps', async () => {
  const db = await database(); try {
    const lease = await claim(db);
    await assert.rejects(finish(db, lease, [toActivityRow(other, sample())]), /Invalid import owner/);
    assert.equal((await db.query('select count(*)::int as n from public.strava_activities')).rows[0].n, 0);
    assert.equal((await db.query('select last_activity_sync_at from public.athletes where id=$1', [owner])).rows[0].last_activity_sync_at, null);
    await assert.rejects(finish(db, { lease_token: null }), /lease changed/);
  } finally { await db.close(); }
});
test('SQL deletion event removes comments and fences a running import from recreating private/deleted data', async () => {
  const db = await database(); try {
    await finish(db, await claim(db));
    await db.exec("insert into public.workout_comments(activity_id,body) select id,'coach feedback' from public.strava_activities;update strava_private.sync_state set last_attempt_at=now()-interval '1 minute';");
    const lease = await claim(db);
    await db.query("select public.handle_strava_event('100','123','delete')");
    await assert.rejects(finish(db, lease), /lease changed/);
    assert.equal((await db.query('select count(*)::int as n from public.workout_comments')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int as n from public.strava_activities')).rows[0].n, 0);
    assert.ok((await db.query("select public.claim_strava_sync($1,'100',false,false) as result", [owner])).rows[0].result.lease_token);
  } finally { await db.close(); }
});
test('SQL disconnect removes provider credentials and history, and stale imports cannot reappear', async () => {
  const db = await database(); try {
    const lease = await claim(db);
    await db.query("select public.disconnect_strava($1,'100')", [owner]);
    await assert.rejects(finish(db, lease), /lease changed/);
    const athlete = (await db.query('select * from public.athletes where id=$1', [owner])).rows[0];
    for (const key of ['strava_id','access_token','refresh_token','token_expires_at']) assert.equal(athlete[key], null);
    assert.equal((await db.query("select public.handle_strava_event('100','100','deauthorize') as result")).rows[0].result.ignored, true);
  } finally { await db.close(); }
});
test('SQL failure cooldown retains the last successful timestamp and blocks repeated provider requests', async () => {
  const db = await database(); try {
    const lease = await claim(db);
    await db.query("select public.release_strava_sync($1,$2,'rate_limited',900)", [owner,lease.lease_token]);
    assert.equal((await claim(db)).reason, 'retry_later');
    const row = (await db.query('select last_activity_sync_at,last_activity_sync_error from public.athletes where id=$1',[owner])).rows[0];
    assert.equal(row.last_activity_sync_at, null); assert.equal(row.last_activity_sync_error,'rate_limited');
  } finally { await db.close(); }
});
test('all lifecycle RPCs deny anonymous and authenticated roles; service role can claim', async () => {
  const db = await database(); try {
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      for (const query of ["select public.claim_strava_sync($1,'100',true,false)","select public.finish_strava_sync($1,'100',null,'[]',false)",
        "select public.release_strava_sync($1,null,'error',30)","select public.disconnect_strava($1,'100')","select public.handle_strava_event('100','123','delete')","select public.pending_strava_sync()"]) {
        await assert.rejects(db.query(query, query.includes('$1') ? [owner] : []), /permission denied/);
      }
      await db.exec('reset role');
    }
    await db.exec('set role service_role'); assert.ok((await claim(db)).lease_token);
  } finally { await db.close(); }
});
test('pagination fetches complete batches and rejects a full final page instead of claiming complete history', async () => {
  const calls = [];
  const rows = Array.from({ length: 200 }, (_, i) => sample(i + 1));
  const get = async (_url, options) => { calls.push(options); return { data: options.params.page === 1 ? rows : [sample(201)] }; };
  const result = await getRecentActivities('test-access',123,{get,maxPages:2});
  assert.equal(result.length,201); assert.deepEqual(calls.map(x=>x.params.page),[1,2]);
  await assert.rejects(getRecentActivities('test-access',123,{get:async()=>({data:rows}),maxPages:2}), error=>error.code==='history_limit');
  await assert.rejects(getRecentActivities('test-access',123,{get:async()=>({data:{error:'bad'}})}), /Invalid Strava/);
});
test('public sync failures never reveal raw provider messages, tokens or legacy stored errors', () => {
  const secret = 'Bearer PRIVATE_ACCESS_TOKEN';
  assert.equal(classifyStravaSyncError({message:secret,response:{status:429,headers:{'retry-after':'120'}}}).retrySeconds,120);
  assert.equal(classifyStravaSyncError({response:{status:401}}).code,'reconnect_required');
  const status = publicStravaSyncStatus({strava_id:'100',last_activity_sync_error:secret});
  assert.equal(status.errorCode,'error'); assert.doesNotMatch(JSON.stringify(status),/PRIVATE|Bearer/);
});

const response = () => ({ code:200,headers:{},setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},status(c){this.code=c;return this;},json(body){this.body=body;return this;} });
process.env.NEXT_PUBLIC_SITE_URL='http://localhost:3000'; process.env.SESSION_COOKIE_SECRET='isolated-strava-test-secret-with-at-least-32-characters';
const request = (method='POST',body={}) => ({method,body,headers:{origin:'http://localhost:3000','content-type':'application/json',cookie:`athlete_id=${signAthleteSession(owner)}`}});
test('manual sync and disconnect reject cross-origin and anonymous access before provider calls', async () => {
  let calls=0;const handler=createStravaConnectionHandler({getClient:()=>({}),getAthlete:async()=>null,sync:async()=>{calls++;}});
  for(const method of ['POST','DELETE']){
    const req=request(method);req.headers.origin='https://attacker.test';const res=response();await handler(req,res);assert.equal(res.code,403);
  }
  const res=response();await handler(request(),res);assert.equal(res.code,401);assert.equal(calls,0);
});
test('disconnect protects Strava-only sign-in; failed provider revocation reports separate local cleanup', async () => {
  const athlete={id:owner,strava_id:'100',supabase_user_id:null};const calls=[];
  const handler=createStravaConnectionHandler({getClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return {data:{removed:3}};}}),getAthlete:async()=>athlete,
    getToken:async()=> 'private-test-access',revoke:async()=>{throw new Error('provider unavailable');}});
  let res=response();await handler(request('DELETE',{confirm:'DISCONNECT STRAVA'}),res);assert.equal(res.code,409);assert.equal(calls.length,0);
  athlete.supabase_user_id=other;res=response();await handler(request('DELETE',{confirm:'DISCONNECT STRAVA'}),res);
  assert.equal(res.code,200);assert.equal(res.body.removed,3);assert.equal(res.body.providerCleanup,'failed');assert.equal(calls[0][1].p_athlete_id,owner);
});
test('revoked Threshold session cannot disconnect or import', async () => {
  const client={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:owner,session_version:2}})})};
  const handler=createStravaConnectionHandler({getClient:()=>client,sync:async()=>assert.fail('revoked session reached provider')});
  const res=response();await handler(request(),res);assert.equal(res.code,401);
});
test('webhook validates both path secret and subscription; challenge does not touch database', async () => {
  let calls=0;const env={STRAVA_WEBHOOK_CALLBACK_SECRET:'a'.repeat(48),STRAVA_WEBHOOK_VERIFY_TOKEN:'verify-only',STRAVA_WEBHOOK_SUBSCRIPTION_ID:'55'};
  const handler=createStravaWebhookHandler({env:()=>env,getClient:()=>({rpc:async()=>{calls++;return {};}})});
  const query={token:env.STRAVA_WEBHOOK_CALLBACK_SECRET,'hub.mode':'subscribe','hub.verify_token':'verify-only','hub.challenge':'challenge'};
  let res=response();await handler({method:'GET',query},res);assert.equal(res.code,200);assert.equal(res.body['hub.challenge'],'challenge');assert.equal(calls,0);
  res=response();await handler({method:'GET',query:{...query,token:'ø'.repeat(48)}},res);assert.equal(res.code,404);
  res=response();await handler({method:'POST',query,body:{subscription_id:56}},res);assert.equal(res.code,403);assert.equal(calls,0);
  res=response();await handler({method:'POST',query,body:{subscription_id:55,owner_id:100,object_id:123,event_time:1791043200,object_type:'activity',aspect_type:'delete'}},res);
  assert.equal(res.code,200);assert.equal(calls,1);
});

function callbackHarness({ signedIn = false, version = 1, role = 'athlete', tier = 'pro' } = {}) {
  const row={id:owner,strava_id:'100',name:'Existing person',primary_role:role,subscription_tier:tier,onboarding_complete:true,session_version:version};
  const writes=[];
  const client={from(table){return {select(){return this;},eq(){return this;},
    update(fields){writes.push(fields);Object.assign(row,fields);return this;},
    insert(){assert.fail('returning OAuth must not replace the account');},
    maybeSingle:async()=>({data:table==='athletes'?row:null}),single:async()=>({data:row})};}};
  const req=request('GET');if(!signedIn) req.headers.cookie='';
  const stateRes=response();const state=createOAuthState(stateRes,'strava');
  req.headers.cookie += `${req.headers.cookie?'; ':''}${stateRes.headers['Set-Cookie'].split(';')[0]}`;
  req.query={code:'test-code',state,scope:'read,activity:read_all'};
  const res=response();res.end=()=>{};res.send=body=>{res.body=body;return res;};
  process.env.STRAVA_CLIENT_ID='100';process.env.STRAVA_CLIENT_SECRET='fake-secret';
  let exchanges=0;
  const handler=createStravaCallbackHandler({getClient:()=>client,exchange:async()=>{exchanges++;return {
    access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,athlete:{id:100,firstname:'Different profile name'}};}});
  return {req,res,row,writes,handler,exchanges:()=>exchanges};
}
test('returning Strava OAuth preserves paid tier, saved name and primary role', async () => {
  for(const [role,tier] of [['athlete','pro'],['coach','coach_pro']]){
    const h=callbackHarness({role,tier});await h.handler(h.req,h.res);
    assert.equal(h.res.statusCode,302);assert.equal(h.row.subscription_tier,tier);assert.equal(h.row.primary_role,role);
    assert.equal(h.row.name,'Existing person');assert.equal(h.writes.length,1);
    assert.equal(h.writes[0].subscription_tier,undefined);assert.equal(h.writes[0].primary_role,undefined);
  }
});
test('callback requires granted activity scope and rejects revoked Threshold sessions', async () => {
  let h=callbackHarness();h.req.query.scope='read';await h.handler(h.req,h.res);
  assert.equal(h.res.headers.Location,'/connections?error=strava_permissions');assert.equal(h.exchanges(),0);assert.equal(h.writes.length,0);
  h=callbackHarness({signedIn:true,version:2});await h.handler(h.req,h.res);
  assert.equal(h.res.code,401);assert.equal(h.writes.length,0);
});
test('callback requires explicit disconnect before linking a different Strava identity', async () => {
  const h=callbackHarness({signedIn:true});h.row.strava_id='200';await h.handler(h.req,h.res);
  assert.equal(h.res.code,409);assert.equal(h.row.strava_id,'200');assert.equal(h.writes.length,0);
});
test('refresh worker is inert without a configured secret and denies callers before database access', async () => {
  let calls=0;const handler=createStravaRefreshHandler({getClient:()=>{calls++;return {rpc:async()=>({data:owner})};},
    secret:()=> 'x'.repeat(48),sync:async()=>({synced:1,skipped:false})});
  let res=response();await handler({method:'GET',headers:{}},res);assert.equal(res.code,401);assert.equal(calls,0);
  res=response();await handler({method:'GET',headers:{authorization:`Bearer ${'x'.repeat(48)}`}},res);assert.equal(res.code,200);assert.equal(res.body.synced,1);
  res=response();await createStravaRefreshHandler({secret:()=>undefined})(request('GET'),res);assert.equal(res.code,503);
});
test('production and external hosts cannot receive credentials through the local provider fixture override', async () => {
  const oldOrigin=process.env.STRAVA_QA_API_ORIGIN,oldEnv=process.env.APP_ENV;
  try {
    process.env.STRAVA_QA_API_ORIGIN='http://127.0.0.1:3102';process.env.APP_ENV='production';
    await assert.rejects(getRecentActivities('private',123,{get:async()=>assert.fail('production attempted fixture request')}),/isolated staging/);
    process.env.APP_ENV='staging';process.env.STRAVA_QA_API_ORIGIN='https://external.example';
    await assert.rejects(getRecentActivities('private',123,{get:async()=>assert.fail('external host received credentials')}),/isolated staging/);
  } finally {
    if(oldOrigin===undefined)delete process.env.STRAVA_QA_API_ORIGIN;else process.env.STRAVA_QA_API_ORIGIN=oldOrigin;
    if(oldEnv===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=oldEnv;
  }
});

test('webhook queue refreshes older activities, deduplicates events and preserves unprocessed edits', async () => {
  const db=await database();
  try {
    await finish(db,await claim(db));
    for(const id of ['900','900','901'])await db.query("select public.handle_strava_event('100',$1,'refresh')",[id]);
    const queued=(await db.query('select pending_activity_ids from strava_private.sync_state')).rows[0];
    assert.deepEqual(queued.pending_activity_ids,['900','901']);
    const admin={from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){
      return {data:(await db.query('select * from public.athletes where id=$1',[owner])).rows[0]};}}),
      async rpc(name,args){
        const names=Object.keys(args),values=Object.values(args).map(value=>Array.isArray(value)?JSON.stringify(value):value);
        try {return {data:(await db.query(`select public.${name}(${names.map((key,index)=>`${key}=>$${index+1}`).join(',')}) as result`,values)).rows[0].result};}
        catch(error){return {error};}
      }};
    let details=0;
    const sync=createActivitySync({listActivities:async()=>[sample()],detailActivity:async(_,id)=>{
      details++;assert.equal(id,'900');return {...sample(900),start_date:'2018-01-01T12:00:00Z',start_date_local:'2018-01-01T12:00:00Z'};
    }});
    const result=await sync(admin,owner);
    assert.equal(result.synced,2);assert.equal(details,1);
    assert.deepEqual((await db.query('select pending_activity_ids,dirty from strava_private.sync_state')).rows[0],{pending_activity_ids:['901'],dirty:true});
    assert.equal((await db.query("select local_date::text from public.strava_activities where strava_activity_id='900'")).rows[0].local_date,'2018-01-01');
    const inaccessible=createActivitySync({listActivities:async()=>[],detailActivity:async()=>{throw {response:{status:404}};}});
    assert.equal((await inaccessible(admin,owner)).reason,'source_deleted');
    assert.deepEqual((await db.query('select pending_activity_ids from strava_private.sync_state')).rows[0].pending_activity_ids,[]);
  } finally {await db.close();}
});
