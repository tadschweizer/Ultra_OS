import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPilotRelease } from '../scripts/verify-pilot-release.mjs';

test('release verifier uses only authenticated GET and zero-row table probes', async()=>{
  const requests=[];
  const report=await verifyPilotRelease({url:'https://project.supabase.co',key:'private-test-key',fetchImpl:async(url,options)=>{
    requests.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.equal(options.headers.apikey,'private-test-key');assert.equal(options.body,undefined);
    if(!url.pathname.includes('/rpc/'))assert.equal(url.searchParams.get('limit'),'0');
    return {ok:true,json:async()=>url.pathname.includes('/rpc/')?true:[]};
  }});
  assert.equal(report.ready,true);assert.equal(requests.length,11);
  assert.equal(JSON.stringify(report).includes('private-test-key'),false);
});

test('missing RPC, unavailable Data API and unexpected rows fail closed without provider details', async()=>{
  for(const failure of ['rpc_false','rpc_404','api_error','unexpected_rows','thrown']){
    const report=await verifyPilotRelease({url:'https://project.supabase.co',key:'private-key',fetchImpl:async url=>{
      if(failure==='thrown')throw new Error('private upstream hostname and credentials');
      const rpc=url.pathname.includes('/rpc/');
      if((failure==='rpc_404'&&rpc)||(failure==='api_error'&&!rpc))return {ok:false};
      return {ok:true,json:async()=>rpc?(failure==='rpc_false'?false:true):(failure==='unexpected_rows'?[{private:'participant data'}]:[])};
    }});
    assert.equal(report.ready,false,failure);
    assert.equal(JSON.stringify(report).includes('private'),false);
  }
});

test('invalid configuration does not touch the network',async()=>{
  for(const url of [undefined,'invalid','https://user:password@project.supabase.co','http://public.example','https://project.supabase.co/unexpected']){
    const report=await verifyPilotRelease({url,key:'private-key',fetchImpl(){throw new Error('must not run');}});
    assert.deepEqual(report,{ready:false,checks:{configuration:'unconfigured'}});
  }
});
