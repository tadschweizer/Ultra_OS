import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceTransport, useWorkspaceTransport } from '../lib/WorkspaceTransport.js';
import { primeMe, getCachedMe, clearMe } from '../lib/meClient.js';
import { calendarMutation } from '../lib/calendarMutation.js';
import { createCopyWeekRequests } from '../lib/copyWeekRequest.js';
import { randomUUID } from 'node:crypto';

const capture = (value) => {
  let transport;
  function Probe() { transport = useWorkspaceTransport(); return null; }
  renderToStaticMarkup(value ? React.createElement(WorkspaceTransport.Provider, { value }, React.createElement(Probe)) : React.createElement(Probe));
  return transport;
};

test('default calendar transport refreshes the shared account cache and scopes to its actual actor', async () => {
  const oldWindow = globalThis.window, oldFetch = globalThis.fetch;
  const data = new Map();
  globalThis.window = { sessionStorage: { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) } };
  const calls=[];
  try {
    primeMe({ athlete: { id: 'real-fixture-coach' }, load: { weekly: 0 } });
    const transport=capture();
    assert.equal(transport.getAccountScope(), 'real-fixture-coach');
    globalThis.fetch=async url => { calls.push(url); return { ok:true, json:async()=>({ athlete:{id:'real-fixture-coach'},load:{weekly:125} }) }; };
    await transport.refreshAccount();
    assert.deepEqual(calls,['/api/me']);
    assert.equal(getCachedMe().load.weekly,125);
  } finally { clearMe(); globalThis.window=oldWindow; globalThis.fetch=oldFetch; }
});

// Portable frontend portion of PR136's calendar acceptance test. The actual
// atomic/private backend contract remains in PR136, not this PR's fixture.
test('copy key survives uncertain response/refresh; successful write releases it before failed refresh; next copy distinct',()=>{
  const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  const copyBody={action:'copy_week',athlete_id:'isolated-runner',from_week_start:'2026-10-05',to_week_start:'2026-10-12'};
  const owner='isolated-coach',stranger='other-isolated-coach';
  const first=createCopyWeekRequests({storage,scope:owner,randomUUID}).begin(copyBody);
  const refreshed=createCopyWeekRequests({storage,scope:owner,randomUUID});
  assert.equal(refreshed.begin(copyBody).client_request_id,first.client_request_id);
  refreshed.complete(first);
  const next=createCopyWeekRequests({storage,scope:owner,randomUUID}).begin(copyBody);
  assert.notEqual(next.client_request_id,first.client_request_id);
  assert.notEqual(createCopyWeekRequests({storage,scope:stranger,randomUUID}).begin(copyBody).client_request_id,next.client_request_id);
});

test('injected synthetic calendar transport never refreshes or reads the native account cache', async () => {
  const oldFetch=globalThis.fetch; let nativeCalls=0; const writes=[];
  try {
    primeMe({athlete:{id:'native-cache-bait'},load:{weekly:777}});
    globalThis.fetch=async()=>{ nativeCalls++; throw new Error('Native transport forbidden in synthetic workspace'); };
    const transport=capture({request:async(url,options)=>{ writes.push({url,body:JSON.parse(options.body)}); return {ok:true,json:async()=>({workouts:[{id:'synthetic-copy'}]})}; },getAccountScope:()=> 'synthetic:demo-coach'});
    await transport.refreshAccount?.();
    const storageData=new Map(),storage={getItem:k=>storageData.get(k),setItem:(k,v)=>storageData.set(k,v)};
    const body={action:'copy_week',athlete_id:'demo-runner',from_week_start:'2026-10-05',to_week_start:'2026-10-12'};
    const pending=createCopyWeekRequests({scope:transport.getAccountScope(),storage});
    const first=pending.begin(body);
    const retry=createCopyWeekRequests({scope:transport.getAccountScope(),storage}).begin(body);
    assert.equal(retry.client_request_id,first.client_request_id);
    await calendarMutation('/api/planned-workouts',{body:retry,request:transport.request});
    assert.equal(writes[0].body.client_request_id,first.client_request_id);
    pending.complete(first);
    assert.notEqual(pending.begin(body).client_request_id,first.client_request_id);
    assert.equal(nativeCalls,0);
    assert.equal(getCachedMe().athlete.id,'native-cache-bait');
    assert.equal(getCachedMe().load.weekly,777);
  } finally { clearMe(); globalThis.fetch=oldFetch; }
});
