import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMe, primeMe, clearMe, getCachedMe } from '../lib/meClient.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { coachReportFixture } from './helpers/coach-report-fixture.mjs';

async function withClient(run) {
  const priorWindow=globalThis.window, priorFetch=globalThis.fetch;
  const storage=new Map();
  globalThis.window={sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
  try {clearMe();await run(storage);} finally {clearMe();globalThis.window=priorWindow;globalThis.fetch=priorFetch;}
}
const transport=result=>({ok:result.code>=200&&result.code<300,status:result.code,json:async()=>result.body});

test('G1: real shared SQL500 produces safe unavailable cache with and without prior profile, then recovers without a new session',async()=>{
  const f=await coachReportFixture();try {
    const cookie=`athlete_id=${signAthleteSession(f.owner,1)}`;
    await withClient(async()=>{
      const faults=[
        ['alter table interventions rename to unavailable_interventions','alter table unavailable_interventions rename to interventions','42P01'],
        ['alter table athletes rename column primary_sports to unavailable_primary_sports','alter table athletes rename column unavailable_primary_sports to primary_sports','42703'],
      ];
      for(const [breakSql,restoreSql,code]of faults)for(const cached of [false,true]) {
        clearMe();const healthy=await f.invokeWithCookie('me',cookie);assert.equal(healthy.code,200);
        if(cached)primeMe(healthy.body);
        await f.pg.exec(`reset role; ${breakSql}; set role service_role`);
        const failed=await f.invokeWithCookie('me',cookie);assert.equal(failed.code,500);
        assert.ok(f.queryErrors.some(error=>error.code===code));
        assert.ok(!JSON.stringify(failed.headers).includes('Max-Age=0'),'transient profile read does not clear session cookie');
        globalThis.fetch=async()=>transport(failed);
        const data=await fetchMe({force:true});
        assert.match(data?.entitlementError||'',/Access could not be verified/);
        assert.equal(data.account.coach_access.eligible,false);assert.equal(data.usage,null);
        assert.equal(getCachedMe(),data);
        await f.pg.exec(`reset role; ${restoreSql}; set role service_role`);
        globalThis.fetch=async()=>transport(await f.invokeWithCookie('me',cookie));
        const recovered=await fetchMe({force:true});assert.equal(recovered.athlete.id,f.owner);
        assert.equal(recovered.entitlementError,undefined);assert.equal(recovered.account.capabilities.coach,true);
      }
    });
  }finally{await f.close();}
});

test('all HTTP5xx use the existing safe access-error state; HTTP401 and403 clear cached access claims',async()=>{
  await withClient(async(storage)=>{
    for(const status of [500,501,502,503,504,599]) {
      primeMe({athlete:{id:'synthetic-coach'},account:{capabilities:{coach:true},coach_access:{eligible:true}},usage:{used:3}});
      globalThis.fetch=async()=>({ok:false,status,json:async()=>({error:'server detail must not become access'})});
      const data=await fetchMe({force:true});assert.match(data.entitlementError,/Access could not be verified/);
      assert.equal(data.account.coach_access.eligible,false);assert.equal(data.usage,null);
    }
    for(const status of [401,403]) {
      primeMe({athlete:{id:'synthetic-coach'},account:{capabilities:{coach:true},coach_access:{eligible:true}}});
      globalThis.fetch=async()=>({ok:false,status});
      assert.equal(await fetchMe({force:true}),null);assert.equal(getCachedMe(),null);assert.equal(storage.size,0);
    }
  });
});

test('real unsigned, expired, invalid and revoked sessions remain401; actual athlete role report access remains403',async()=>{
  const f=await coachReportFixture();try {
    await withClient(async()=>{
      const tokens=['',signAthleteSession(f.owner,1,Date.now()-1000),'invalid-signed-session',signAthleteSession(f.owner,99)];
      for(const token of tokens) {
        const result=await f.invokeWithCookie('me',token?`athlete_id=${token}`:'');assert.equal(result.code,401);
        assert.match(JSON.stringify(result.headers),/Max-Age=0/);
        primeMe({athlete:{id:f.owner},account:{capabilities:{coach:true},coach_access:{eligible:true}}});
        globalThis.fetch=async()=>transport(result);
        assert.equal(await fetchMe({force:true}),null);assert.equal(getCachedMe(),null);
      }
      const denied=await f.invokeWithCookie('detail',`athlete_id=${signAthleteSession(f.athlete,1)}`,{athlete_id:f.athlete});
      assert.equal(denied.code,403);
      primeMe({athlete:{id:f.owner},account:{capabilities:{coach:true}}});globalThis.fetch=async()=>transport(denied);
      assert.equal(await fetchMe({force:true}),null);assert.equal(getCachedMe(),null);
    });
  }finally{await f.close();}
});
