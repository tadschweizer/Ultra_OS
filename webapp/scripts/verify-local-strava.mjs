// Destructive acceptance restricted to the named loopback Supabase QA stack.
// Strava payloads are synthetic; database/Auth/PostgREST operations are real.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createActivitySync } from '../lib/activitySync.js';
import { decorateWorkoutsWithCompliance } from '../lib/workoutCompliance.js';
import { createStravaConnectionHandler } from '../pages/api/strava/connection.js';
import { createStravaWebhookHandler } from '../pages/api/strava/webhook/[token].js';
import { createStravaRefreshHandler } from '../pages/api/strava/refresh-pending.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
const status = JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase',
  ['status','--workdir','../output/p010-012-supabase','-o','json'], {encoding:'utf8',stdio:['ignore','pipe','ignore']}));
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1');assert.equal(new URL(status.DB_URL).hostname,'127.0.0.1');
const db=new pg.Client({connectionString:status.DB_URL});await db.connect();
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const anon=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false}});
const checked=async promise=>{const r=await promise;if(r.error)throw r.error;return r.data;};
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},status(c){this.code=c;return this;},json(body){this.body=body;return this;}});
const evidence={date:new Date().toISOString(),environment:'real isolated local Supabase/PostgREST/Auth; synthetic Strava provider payloads',checks:[],completed:false};
const pass=name=>{evidence.checks.push(name);console.log('PASS:',name);};
let owner,user;
try {
  if(process.argv.includes('--apply')){
    await db.query('begin');
    await db.query(await readFile('supabase/migrations/20261003231047_strava_import_lifecycle.sql','utf8'));
    await db.query('commit');await new Promise(resolve=>setTimeout(resolve,1000));
  }
  // Clean only previous disposable attempts in this isolated project.
  for (const prior of (await checked(admin.auth.admin.listUsers({perPage:1000}))).users) {
    if (!/^strava-local-[0-9a-f-]{36}@example\.test$/.test(prior.email || '')) continue;
    await checked(admin.from('athletes').delete().eq('supabase_user_id',prior.id));
    await checked(admin.auth.admin.deleteUser(prior.id));
  }
  const email=`strava-local-${crypto.randomUUID()}@example.test`;
  const password=crypto.randomBytes(24).toString('hex');
  user=(await checked(admin.auth.admin.createUser({email,password,email_confirm:true}))).user;
  owner=await checked(admin.from('athletes').insert({name:'Disposable Strava lifecycle QA',email,supabase_user_id:user.id,
    strava_id:`90${crypto.randomInt(10000000,99999999)}`,access_token:'synthetic-access',refresh_token:'synthetic-refresh',token_expires_at:new Date(Date.now()+86400000).toISOString()}).select().single());
  const activity={id:90123456789,name:'Synthetic evening run',sport_type:'Run',type:'Run',start_date:'2026-10-03T01:00:00Z',start_date_local:'2026-10-02T19:00:00Z',moving_time:3600,distance:10000,average_heartrate:145};
  const plan=await checked(admin.from('planned_workouts').insert({athlete_id:owner.id,workout_date:'2026-10-02',title:'Disposable planned run',sport:'run',planned_duration_min:60}).select().single());
  const sync=createActivitySync({listActivities:async()=>[activity,activity]});
  assert.equal((await sync(admin,owner.id)).synced,1);
  let rows=await checked(admin.from('strava_activities').select('*').eq('athlete_id',owner.id));
  assert.equal(rows.length,1);assert.equal(rows[0].local_date,'2026-10-02');
  assert.equal(decorateWorkoutsWithCompliance([plan],rows)[0].status,'completed');pass('Provider import is persisted once and matches the planned workout on the athlete local day');
  const stamps=await checked(admin.from('athletes').select('last_activity_sync_at,activity_backfill_completed_at').eq('id',owner.id).single());assert.ok(stamps.activity_backfill_completed_at);
  await db.query("update strava_private.sync_state set last_attempt_at=now()-interval '1 minute' where athlete_id=$1",[owner.id]);
  const fail=createActivitySync({listActivities:async()=>{throw {message:'Bearer DO_NOT_EXPOSE',response:{status:429,headers:{'retry-after':'120'}}};}});
  assert.equal((await fail(admin,owner.id,{force:true})).reason,'rate_limited');
  const failed=await checked(admin.from('athletes').select('last_activity_sync_at,last_activity_sync_error').eq('id',owner.id).single());
  assert.equal(failed.last_activity_sync_at,stamps.last_activity_sync_at);assert.equal(failed.last_activity_sync_error,'rate_limited');assert.equal((await sync(admin,owner.id,{force:true})).reason,'retry_later');pass('Rate limit cooldown preserves saved training and last successful import; provider secrets are not stored');
  const args={p_athlete_id:owner.id,p_strava_id:owner.strava_id,p_force:true,p_history:false};
  assert.ok((await anon.rpc('claim_strava_sync',args)).error);
  const signed=await checked(anon.auth.signInWithPassword({email,password}));
  const authenticated=createClient(status.API_URL,status.ANON_KEY,{global:{headers:{Authorization:`Bearer ${signed.session.access_token}`}},auth:{persistSession:false}});
  assert.ok((await authenticated.rpc('claim_strava_sync',args)).error);
  await db.query("update strava_private.sync_state set retry_at=null,last_attempt_at=now()-interval '1 minute' where athlete_id=$1",[owner.id]);
  const claims=await Promise.all([admin.rpc('claim_strava_sync',args),admin.rpc('claim_strava_sync',args)]);
  for(const r of claims)assert.equal(r.error,null);
  assert.equal(claims.filter(r=>r.data.lease_token).length,1);assert.equal(claims.filter(r=>r.data.reason==='in_progress').length,1);pass('Actual PostgREST concurrency grants one lease; anonymous and real authenticated RPCs denied');
  const lease=claims.find(r=>r.data.lease_token).data.lease_token;
  const env={STRAVA_WEBHOOK_CALLBACK_SECRET:crypto.randomBytes(24).toString('hex'),STRAVA_WEBHOOK_VERIFY_TOKEN:'local-verification-only',STRAVA_WEBHOOK_SUBSCRIPTION_ID:'55'};
  const handler=createStravaWebhookHandler({getClient:()=>admin,env:()=>env});
  let res=response();await handler({method:'POST',query:{token:env.STRAVA_WEBHOOK_CALLBACK_SECRET},body:{subscription_id:55,owner_id:Number(owner.strava_id),object_id:activity.id,object_type:'activity',aspect_type:'delete',event_time:1791043200}},res);
  assert.equal(res.code,200);assert.equal((await checked(admin.from('strava_activities').select('id').eq('athlete_id',owner.id))).length,0);
  assert.ok((await admin.rpc('finish_strava_sync',{p_athlete_id:owner.id,p_strava_id:owner.strava_id,p_lease_token:lease,p_rows:rows,p_backfilled:false})).error);pass('Deletion webhook removes persisted activity and fences stale import completion');
  const workerSecret=crypto.randomBytes(24).toString('hex');
  const oldActivity={...activity,id:activity.id+1,start_date:'2018-01-01T12:00:00Z',start_date_local:'2018-01-01T12:00:00Z'};
  await checked(admin.rpc('handle_strava_event',{p_owner_id:owner.strava_id,p_activity_id:String(oldActivity.id),p_action:'refresh'}));
  res=response();await createStravaRefreshHandler({getClient:()=>admin,
    sync:createActivitySync({listActivities:async()=>[],detailActivity:async()=>oldActivity}),secret:()=>workerSecret})(
      {method:'GET',headers:{authorization:`Bearer ${workerSecret}`}},res);
  assert.equal(res.code,200);assert.equal(res.body.synced,1);
  assert.equal((await checked(admin.from('strava_activities').select('local_date').eq('athlete_id',owner.id).single())).local_date,'2018-01-01');
  pass('Authenticated refresh worker imports an older queued edit through real PostgREST without waiting for a page load');
  process.env.NEXT_PUBLIC_SITE_URL='http://localhost:3100';
  process.env.SESSION_COOKIE_SECRET=crypto.randomBytes(32).toString('hex');
  res=response();await createStravaConnectionHandler({getClient:()=>admin,getToken:async()=> 'synthetic-access',revoke:async()=>{throw new Error('synthetic outage');}})(
    {method:'DELETE',body:{confirm:'DISCONNECT STRAVA'},headers:{origin:'http://localhost:3100','content-type':'application/json',cookie:`athlete_id=${encodeURIComponent(signAthleteSession(owner.id))}`}},res);
  assert.equal(res.code,200);assert.equal(res.body.providerCleanup,'failed');
  const disconnected=await checked(admin.from('athletes').select('strava_id,access_token,refresh_token').eq('id',owner.id).single());assert.deepEqual(disconnected,{strava_id:null,access_token:null,refresh_token:null});
  assert.ok(await checked(admin.from('planned_workouts').select('id').eq('id',plan.id).single()));pass('Disconnect removes credentials, reports separate provider cleanup and preserves manual planned training');
  evidence.completed=true;
} finally {
  if(owner)await checked(admin.from('athletes').delete().eq('id',owner.id));if(user)await checked(admin.auth.admin.deleteUser(user.id));
  await writeFile('../output/p010-012-local-strava-acceptance.json',JSON.stringify(evidence,null,2));await db.end();
}
