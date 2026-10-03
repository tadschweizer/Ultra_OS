import test from 'node:test';
import assert from 'node:assert/strict';

import { hasDateWindowOverlap, isActiveProtocolStatus, validateProtocolWindow } from '../lib/coachProtocols.js';
import { createCurrentProtocolHandler } from '../pages/api/current-protocol-assignment.js';

test('validateProtocolWindow enforces valid date ranges', () => {
  assert.equal(validateProtocolWindow('2026-05-01', '2026-05-21').valid, true);
  assert.equal(validateProtocolWindow('2026-05-21', '2026-05-01').valid, false);
  assert.equal(validateProtocolWindow('bad', '2026-05-01').valid, false);
});

test('hasDateWindowOverlap detects assignment conflicts', () => {
  assert.equal(hasDateWindowOverlap('2026-05-01', '2026-05-14', '2026-05-14', '2026-05-28'), true);
  assert.equal(hasDateWindowOverlap('2026-05-01', '2026-05-13', '2026-05-14', '2026-05-28'), false);
});

test('isActiveProtocolStatus only flags active lifecycle states', () => {
  assert.equal(isActiveProtocolStatus('assigned'), true);
  assert.equal(isActiveProtocolStatus('in_progress'), true);
  assert.equal(isActiveProtocolStatus('active'), true);
  assert.equal(isActiveProtocolStatus('completed'), false);
  assert.equal(isActiveProtocolStatus('abandoned'), false);
});

function protocolHarness({ races=[], legacyError=null, legacy=null }={}) {
  const selections=[];
  const client={from(table){let fields;return {select(value){fields=value;selections.push([table,value]);return this;},eq(){return this;},gte(){return this;},order(){return this;},maybeSingle(){return this;},then(resolve,reject){return Promise.resolve(table==='athletes'?fields==='target_race_id'?{data:{target_race_id:races[0]?.id}}:{data:legacy,error:legacyError}:{data:table==='races'?races:[]}).then(resolve,reject);}};}};
  const handler=createCurrentProtocolHandler({getClient:()=>client,getAthleteId:async()=> 'owner'});
  const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  return {handler,res,selections};
}
test('structured race loads without querying undocumented legacy athlete columns',async()=>{
  const h=protocolHarness({races:[{id:'race',name:'Target race',event_date:'2027-01-01'}]});
  await h.handler({method:'GET'},h.res);assert.equal(h.res.code,200);assert.equal(h.res.body.currentRace.name,'Target race');
  assert.equal(h.selections.filter(([table])=>table==='athletes').length,1);
});
test('absent legacy race columns allow an empty summary; legacy records remain supported',async()=>{
  for(const code of ['42703','PGRST204']) {
    const h=protocolHarness({legacyError:{code}});await h.handler({method:'GET'},h.res);assert.equal(h.res.code,200);assert.equal(h.res.body.currentRace,null);
  }
  const h=protocolHarness({legacy:{target_race:'Legacy target',target_race_date:'2027-01-01'}});await h.handler({method:'GET'},h.res);
  assert.equal(h.res.body.currentRace.name,'Legacy target');
});
test('legacy race permission failures are not misreported as missing columns',async()=>{
  const h=protocolHarness({legacyError:{code:'42501',message:'private database detail'}});await h.handler({method:'GET'},h.res);
  assert.equal(h.res.code,503);assert.doesNotMatch(JSON.stringify(h.res.body),/private database detail/);
});
