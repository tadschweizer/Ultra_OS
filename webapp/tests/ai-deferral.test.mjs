import test from 'node:test';
import assert from 'node:assert/strict';
import raceSearch from '../pages/api/exa/race-search.js';
import raceEnrich from '../pages/api/exa/race-enrich.js';
import trainingContent from '../pages/api/exa/training-content.js';
import newsFeed from '../pages/api/exa/news-feed.js';
import researchDraft from '../pages/api/research-library/draft.js';
import { searchRaces, enrichRace, searchTrainingContent, fetchNewsFeed } from '../lib/exa.js';
import { buildResearchDraft } from '../lib/researchDrafts.js';
import { RELEASE_CAPABILITIES } from '../lib/releaseCapabilities.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { AUTH_COOKIE_NAME } from '../lib/auth/contracts.js';

process.env.SESSION_COOKIE_SECRET = 'isolated-deferral-session-secret';
const id = '11111111-1111-4111-8111-111111111111';
const routes = [[raceSearch,'GET'],[raceEnrich,'GET'],[trainingContent,'GET'],[newsFeed,'GET'],[researchDraft,'POST']];
function response() {
  return { code:0, headers:{}, status(code){this.code=code;return this;},
    setHeader(key,value){this.headers[key]=value;}, json(body){this.body=body;return this;},end(){return this;} };
}

test('deferred routes reject every signed caller before provider or generation work, despite client and environment overrides', async(t)=>{
  const previous = process.env.EXA_API_KEY;
  process.env.EXA_API_KEY='isolated-provider-key';
  process.env.AUTOMATED_ASSISTANCE_ENABLED='true';
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('External work must not run');});
  try {
    for (const [handler,method] of routes) for (const role of ['athlete','coach','admin']) {
      const res=response();
      await handler({method,headers:{cookie:`${AUTH_COOKIE_NAME}=${signAthleteSession(id)}`},
        query:{q:'Boston',name:'Boston',sport:'running',enabled:'true',role,subscription_tier:'coach'},
        body:{title:'Unreviewed paper',role,is_admin:true,automatedAssistance:true}},res);
      assert.equal(res.code,403); assert.equal(res.body.code,'FEATURE_DEFERRED');
      assert.equal(res.headers['Cache-Control'],'private, no-store');
      assert.equal(res.body.draft,undefined);
    }
    assert.equal(calls,0);
  } finally {
    if(previous===undefined)delete process.env.EXA_API_KEY;else process.env.EXA_API_KEY=previous;
    delete process.env.AUTOMATED_ASSISTANCE_ENABLED;
  }
});

test('deferred routes retain authentication and method boundaries',async()=>{
  for (const [handler,method] of routes) {
    const anonymous=response(); await handler({method,headers:{},query:{},body:{}},anonymous);
    assert.equal(anonymous.code,401);
    const wrongMethod=response(); await handler({method:'DELETE',headers:{cookie:`${AUTH_COOKIE_NAME}=${signAthleteSession(id)}`},query:{}},wrongMethod);
    assert.equal(wrongMethod.code,405);
  }
});

test('direct provider and draft entry points fail closed for future jobs without network traffic or speculative summaries',async(t)=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('Unexpected request');});
  for(const run of [()=>searchRaces('race'),()=>enrichRace('race'),()=>searchTrainingContent('running'),()=>fetchNewsFeed('running')]) {
    await assert.rejects(run,{code:'FEATURE_DEFERRED'});
  }
  assert.throws(()=>buildResearchDraft({title:'Study'}),{code:'FEATURE_DEFERRED'});
  assert.equal(calls,0);
  assert.equal(RELEASE_CAPABILITIES.automatedAssistance,false);
  assert.throws(()=>{RELEASE_CAPABILITIES.automatedAssistance=true;},TypeError);
});
