import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAccountExport, redactExport, EXPORT_TABLES } from '../lib/accountExport.js';
import { createAccountExportHandler } from '../pages/api/account-export.js';
import { createDeleteAccountHandler } from '../pages/api/delete-account.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
process.env.SESSION_COOKIE_SECRET='account-data-tests-secret-at-least-32-characters';
process.env.NEXT_PUBLIC_SITE_URL='https://threshold.example';
const id='11111111-1111-4111-8111-111111111111';
function response(){return {code:null,body:null,headers:{},getHeader(k){return this.headers[k];},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};}
const req=(method='POST')=>({method,headers:{origin:'https://threshold.example','content-type':'application/json',cookie:`athlete_id=${signAthleteSession(id,1)}`},body:{confirm:'DELETE MY ACCOUNT',athleteId:'foreign-account'}});
test('archive redacts nested credentials while preserving training values and notes',()=>{
  assert.deepEqual(redactExport({name:'Athlete',strava_access_token:'secret',session_version:1,records:[{note:'hello',api_key:'secret',nested:{refresh_token:'hidden',legs:7}}]}),{name:'Athlete',records:[{note:'hello',nested:{legs:7}}]});
});
test('archive paginates every personal table, scopes to signed owner and handles settings primary key',async()=>{
  const calls=[];
  const admin={from(table){return {select(){return this;},eq(column,value){if(column==='visibility'){assert.equal(table,'planned_workouts');assert.equal(value,'athlete_visible');return this;}assert.equal(column,table==='message_drafts'?'owner_id':table==='message_email_deliveries'?'recipient_id':'athlete_id');assert.equal(value,id);return this;},order(column){calls.push([table,column]);return this;},async range(start,end){return {data:start===0?[{id:'1',notes:'first'},{id:'2',notes:'second'}]:start===2?[{id:'3',notes:'third'}]:[]};}};}};
  const archive=await collectAccountExport(admin,{id,strava_refresh_token:'private'},{pageSize:2});
  assert.equal(archive.sections.interventions.length,3);assert.equal(archive.sections.profile.strava_refresh_token,undefined);
  assert.ok(calls.some(([table,column])=>table==='athlete_settings'&&column==='athlete_id'));
  assert.deepEqual(Object.keys(archive.sections).sort(),['profile',...EXPORT_TABLES].sort());
});
test('missing optional feature tables are named in the archive; other database failures stop download',async()=>{
  let error={code:'42P01'};
  const admin={from(){return {select(){return this;},eq(){return this;},order(){return this;},async range(){return {error};}};}};
  const archive=await collectAccountExport(admin,{id});assert.deepEqual(archive.unavailableSections,EXPORT_TABLES);
  error={code:'08006',message:'private connection failure'};await assert.rejects(collectAccountExport(admin,{id}));
});
test('export rejects cross origin before client access and expired sessions before record reads',async()=>{
  let calls=0;const handler=createAccountExportHandler({getClient:()=>{calls++;return {};},getAthlete:async()=>null});
  const cross=req();cross.headers.origin='https://attacker.example';const a=response();await handler(cross,a);assert.equal(a.code,403);assert.equal(calls,0);
  const b=response();await handler(req(),b);assert.equal(b.code,401);assert.equal(calls,1);
});
function deletionHarness({revoked=false,billingFails=false,dbFails=false,authFails=false,optionalSchemaCode=null}={}){
  const changes=[];
  const athlete={id,stripe_customer_id:'cus_1',supabase_user_id:'auth_1'};
  const client={auth:{admin:{async deleteUser(){changes.push('auth-delete');return {error:authFails?{message:'private auth error'}:null};}}},from(table){return {
    select(){return this;},eq(){return this;},async maybeSingle(){return {data:athlete};},
    update(){changes.push(`update:${table}`);return this;},delete(){changes.push(`delete:${table}`);return this;},
    then(resolve,reject){return Promise.resolve({error:dbFails?{message:'private sql detail'}:optionalSchemaCode&&table!=='athletes'?{code:optionalSchemaCode,message:'Could not find the table in the schema cache'}:null}).then(resolve,reject);}
  };}};
  const stripe={subscriptions:{async list(){if(billingFails)throw new Error('private Stripe error');return {data:[{id:'sub_1',status:'active'}]};},async cancel(){changes.push('cancel');}},customers:{async del(){changes.push('customer-delete');}}};
  return {changes,handler:createDeleteAccountHandler({getClient:()=>client,getAthlete:async()=>revoked?null:athlete,getStripe:()=>stripe})};
}
test('deletion verifies current session revocation before any provider or data mutation',async()=>{
  const h=deletionHarness({revoked:true});const res=response();await h.handler(req('DELETE'),res);assert.equal(res.code,401);assert.deepEqual(h.changes,[]);
});
test('deletion rejects cross origin before any provider or data mutation',async()=>{
  const h=deletionHarness();const request=req('DELETE');request.headers.origin='https://attacker.example';const res=response();await h.handler(request,res);assert.equal(res.code,403);assert.deepEqual(h.changes,[]);
});
test('failed billing cleanup blocks data deletion, preserves account and sanitizes errors',async()=>{
  const h=deletionHarness({billingFails:true});const res=response();await h.handler(req('DELETE'),res);assert.equal(res.code,503);assert.deepEqual(h.changes,[]);assert.equal(JSON.stringify(res.body).includes('private'),false);
});
test('successful deletion stops billing before any training mutation and clears session',async()=>{
  const h=deletionHarness();const res=response();await h.handler(req('DELETE'),res);assert.equal(res.code,200);assert.equal(res.body.success,true);assert.deepEqual(h.changes.slice(0,2),['cancel','customer-delete']);assert.ok(h.changes.includes('delete:athletes'));assert.ok(res.headers['Set-Cookie']);
});
test('database deletion failure is sanitized and does not claim success',async()=>{
  const h=deletionHarness({dbFails:true});const res=response();await h.handler(req('DELETE'),res);assert.equal(res.code,503);assert.equal(res.body.success,undefined);assert.equal(JSON.stringify(res.body).includes('private'),false);
});
test('external sign-in cleanup failure is explicit after data removal',async()=>{
  const h=deletionHarness({authFails:true});const res=response();await h.handler(req('DELETE'),res);assert.equal(res.code,200);assert.equal(res.body.auth_cleanup,'failed');
});

test('deletion tolerates PostgREST missing optional tables/columns but not permission failures',async()=>{
  for(const code of ['PGRST205','PGRST204','42P01','42703']) {
    const h=deletionHarness({optionalSchemaCode:code});const res=response();await h.handler(req('DELETE'),res);
    assert.equal(res.code,200);assert.ok(h.changes.includes('delete:athletes'));
  }
  const h=deletionHarness({optionalSchemaCode:'42501'});const res=response();await h.handler(req('DELETE'),res);
  assert.equal(res.code,503);assert.equal(h.changes.includes('delete:athletes'),false);
});
