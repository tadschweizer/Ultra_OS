import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import Stripe from 'stripe';
import { safeResourceUrl } from '../lib/safeResourceUrl.js';
import { createStravaWebhookHandler } from '../pages/api/strava/webhook/[token].js';
import coros from '../pages/api/webhooks/coros/activities.js';
import { createBillingWebhookHandler } from '../pages/api/billing/webhook.js';
import { createReadinessHandler } from '../pages/api/ready.js';
import { checkAuthRateLimit, enforceAuthRateLimit, getClientIp } from '../lib/auth/rateLimit.js';
import { createCoachSharedDocsHandler } from '../pages/api/coach/shared-docs.js';
import { pilotDb, coachOwnerId, athleteId } from './helpers/pilotDb.mjs';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';

process.env.SESSION_COOKIE_SECRET = 'security-tests-only-session-secret';
process.env.NEXT_PUBLIC_SITE_URL = 'https://threshold.example';
const response = () => ({ headers: {}, setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;} });
const stream = (body, headers={}) => Object.assign(Readable.from([Buffer.from(body)]),{method:'POST',headers});
const signed = (body, secret, t=Math.floor(Date.now()/1000)) => `t=${t},v1=${crypto.createHmac('sha256',secret).update(`${t}.${body}`).digest('hex')}`;

test('unsafe schemes, active files, ambiguous and malformed URLs are rejected', () => {
  for(const url of ['javascript:alert(1)','data:text/html,test','file:///tmp/a','//evil.test','http://example.test/a',
    'https://u:p@example.test/a','https://example.test/a.svg','https://example.test/a%2Eexe','https://example.test/a.html.jpg',
    'https://example.test/a.zip','https://example.test/a.docm','https://example.test/a\\b','https://example.test/%00a','https://example.test/%XX',{},' https://example.test']) {
    assert.equal(safeResourceUrl(url),null,JSON.stringify(url));
  }
  assert.equal(safeResourceUrl('https://drive.google.com/file/d/123/view'),'https://drive.google.com/file/d/123/view');
  assert.equal(safeResourceUrl('https://example.test/training.pdf'),'https://example.test/training.pdf');
});

test('shared docs reject unsafe links, oversized text and multipart; preserve inert text and safe links', async () => {
  const db=pilotDb();db.tables.coach_shared_docs=[];
  const handler=createCoachSharedDocsHandler({getClient:()=>db});
  const invoke=async(body,headers={})=>{const res=response();await handler({method:'POST',body,headers:{origin:'https://threshold.example','content-type':'application/json',cookie:`athlete_id=${signAthleteSession(coachOwnerId,1)}`,...headers}},res);return res;};
  const base={athlete_id:athleteId,title:'Training',doc_type:'link'};
  for(const resource_url of ['javascript:alert(1)','https://example.test/a.exe',{},'data:text/html,<script>']) {
    assert.equal((await invoke({...base,resource_url})).code,400);
  }
  assert.equal((await invoke({...base,resource_url:'https://example.test/a.pdf'},{'content-type':'multipart/form-data'})).code,415);
  assert.equal((await invoke({...base,resource_url:'https://example.test/a.pdf'},{origin:'https://evil.test'})).code,403);
  assert.equal((await invoke({...base,title:'a'.repeat(201)})).code,400);
  assert.equal(db.tables.coach_shared_docs.length,0);
  assert.equal((await invoke({...base,title:'<img src=x onerror=alert(1)>',resource_url:'https://example.test/a.pdf'})).code,200);
  db.tables.coach_shared_docs.push({id:'legacy',coach_id:db.tables.coach_profiles[0].id,athlete_id:athleteId,resource_url:'javascript:alert(1)'});
  const res=response();await handler({method:'GET',query:{athlete_id:athleteId},headers:{cookie:`athlete_id=${signAthleteSession(coachOwnerId,1)}`}},res);
  assert.equal(res.body.docs.find(d=>d.id==='legacy').resource_url,null);
});

test('COROS refuses all ingestion, even if callers supply apparent authentication', () => {
  for(const headers of [{},{authorization:'Bearer anything'}]){const res=response();coros({method:'POST',headers,body:{workoutId:'1'}},res);assert.equal(res.code,503);}
});

test('Strava rejects missing, altered, stale, future, malformed and oversized signed bodies before DB access', async () => {
  const env={STRAVA_WEBHOOK_CALLBACK_SECRET:'x'.repeat(48),STRAVA_WEBHOOK_SIGNING_SECRET:'test-secret',STRAVA_WEBHOOK_SUBSCRIPTION_ID:'55'};
  let calls=0;
  const handler=createStravaWebhookHandler({env:()=>env,getClient:()=>({rpc:async()=>{calls++;return {};}})});
  const body=JSON.stringify({subscription_id:55,owner_id:100,object_id:123,event_time:Math.floor(Date.now()/1000),object_type:'activity',aspect_type:'update'});
  const invoke=async(raw,header)=>{const req=stream(raw,{'x-strava-signature':header});req.query={token:env.STRAVA_WEBHOOK_CALLBACK_SECRET};const res=response();await handler(req,res);return res;};
  for(const header of [undefined,'invalid',signed(body,'wrong'),signed(body,env.STRAVA_WEBHOOK_SIGNING_SECRET,1),signed(body,env.STRAVA_WEBHOOK_SIGNING_SECRET,Math.floor(Date.now()/1000)+600),'t=abc,v1=00','t=1,t=2']) {
    assert.equal((await invoke(body,header)).code,403);
  }
  assert.equal((await invoke(body+' ',signed(body,env.STRAVA_WEBHOOK_SIGNING_SECRET))).code,403);
  const large='a'.repeat(16385);assert.equal((await invoke(large,signed(large,env.STRAVA_WEBHOOK_SIGNING_SECRET))).code,400);
  assert.equal(calls,0);
  assert.equal((await invoke(body,signed(body,env.STRAVA_WEBHOOK_SIGNING_SECRET))).code,200);
  assert.equal(calls,1);
  delete env.STRAVA_WEBHOOK_SIGNING_SECRET;assert.equal((await invoke(body,'x')).code,503);assert.equal(calls,1);
});

test('Stripe rejects tampering, expired signatures, absent secrets and oversized payloads before DB access', async () => {
  const secret='whsec_test_security',sdk=new Stripe('sk_test_fake');
  const handler=createBillingWebhookHandler({getStripe:()=>sdk,secret:()=>secret,getClient:()=>assert.fail('invalid request reached database')});
  const body=JSON.stringify({id:'evt_test',type:'invoice.paid',data:{object:{customer:'cus_test'}}});
  for(const [raw,signature] of [[body,undefined],[body+' ',Stripe.webhooks.generateTestHeaderString({payload:body,secret})],[body,Stripe.webhooks.generateTestHeaderString({payload:body,secret,timestamp:1})],['x'.repeat(1048577),'invalid']]) {
    const res=response();await handler(stream(raw,{'stripe-signature':signature}),res);assert.equal(res.code,400);
  }
  const res=response();await createBillingWebhookHandler({getStripe:()=>sdk,secret:()=>undefined})(stream(body,{'stripe-signature':'x'}),res);assert.equal(res.code,503);
});

test('deep readiness never touches dependencies without configured valid authentication', async () => {
  for(const secret of [undefined,'x'.repeat(32)]) {
    const handler=createReadinessHandler({secret:()=>secret,getClient:()=>assert.fail('unauthorized probe touched database')});
    const res=response();await handler({method:'GET',headers:{}},res);assert.equal(res.code,secret?401:503);
  }
});

test('auth limiter fails closed, returns retryable status and ignores forged proxy headers', async () => {
  const admin={rpc:async()=>({error:new Error('private detail')})};
  const res=response();assert.equal(await enforceAuthRateLimit(admin,res,{kind:'login',identifier:'a@example.test',ip:'1.2.3.4'}),false);
  assert.equal(res.code,503);assert.equal(res.headers['Retry-After'],'60');assert.ok(!res.body.error.includes('private'));
  assert.equal(getClientIp({headers:{'cf-connecting-ip':'8.8.8.8','x-forwarded-for':'2.2.2.2'},socket:{remoteAddress:'127.0.0.1'}},{}),'127.0.0.1');
  const keys=[];await checkAuthRateLimit({rpc:async(_n,args)=>{keys.push(args.p_key);return {data:true};}},{kind:'login',identifier:'A@example.test',ip:'1.2.3.4'});
  assert.equal(keys.length,2);assert.ok(keys.every(k=>/^[a-f0-9]{64}$/.test(k)));
});

test('database migration restricts summaries and atomically reserves limited attempts', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create function public.get_coach_dashboard_summary(uuid) returns int language sql security definer as 'select 1';
      create function public.calculate_protocol_compliance(uuid) returns int language sql security definer as 'select 1';
      grant execute on all functions in schema public to authenticated;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261016034417_security_boundary_hardening.sql',import.meta.url),'utf8'));
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      for(const name of ['get_coach_dashboard_summary','calculate_protocol_compliance']) {
        await assert.rejects(db.query(`select public.${name}('11111111-1111-4111-8111-111111111111')`),/permission denied/);
      }
      await assert.rejects(db.query("select public.consume_auth_rate_limit(repeat('a',64),8,900)"),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const results=await Promise.all(Array.from({length:20},()=>db.query("select public.consume_auth_rate_limit(repeat('a',64),8,900) allowed")));
    assert.equal(results.filter(r=>r.rows[0].allowed).length,8);
    await db.exec("update public.auth_rate_buckets set started_at=now()-interval '1 hour'");
    assert.equal((await db.query("select public.consume_auth_rate_limit(repeat('a',64),8,900) allowed")).rows[0].allowed,true);
    assert.equal((await db.query("select public.get_coach_dashboard_summary('11111111-1111-4111-8111-111111111111') n")).rows[0].n,1);
  } finally { await db.close(); }
});
