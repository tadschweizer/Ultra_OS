// Synthetic Strava HTTP fixture, bound to loopback. No real provider account.
// Seeds only the isolated runbook's labelled demo athlete, never a remote project.
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const status=JSON.parse(execFileSync(process.platform==='win32'?'supabase.exe':'supabase',
  ['status','--workdir','../output/p010-012-supabase','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1');
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const pair=JSON.parse(await readFile('.qa-private/local-demo.json','utf8'));
const checked=async promise=>{const r=await promise;if(r.error)throw r.error;return r.data;};
const athlete=await checked(admin.from('athletes').select('strava_id').eq('id',pair.athlete.id).single());
assert.ok(!athlete.strava_id||athlete.strava_id==='99000000001','Fixture cannot replace another Strava connection');
await checked(admin.from('athletes').update({strava_id:'99000000001',access_token:'threshold-local-fixture-expired',
  refresh_token:'threshold-local-fixture-refresh',token_expires_at:new Date(0).toISOString(),
  last_activity_sync_at:null,activity_backfill_completed_at:null,last_activity_sync_error:null}).eq('id',pair.athlete.id));
let authorized=true;
const activity={id:99123456789,name:'QA evening run — synthetic Strava fixture',sport_type:'Run',type:'Run',
  start_date:'2026-10-03T01:00:00Z',start_date_local:'2026-10-02T19:00:00Z',utc_offset:-21600,
  moving_time:3600,elapsed_time:3650,distance:10000,total_elevation_gain:150,average_heartrate:145};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const url=new URL(req.url,'http://127.0.0.1:3102');
  if(url.pathname==='/api/v3/oauth/token'&&req.method==='POST'){
    if(!authorized){res.statusCode=401;res.end(JSON.stringify({message:'Authorization revoked'}));return;}
    res.end(JSON.stringify({access_token:'threshold-local-fixture-access',refresh_token:'threshold-local-fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600}));return;
  }
  if(url.pathname==='/oauth/deauthorize'&&req.method==='POST'){
    authorized=false;res.end(JSON.stringify({access_token:'threshold-local-fixture-revoked'}));return;
  }
  if(url.pathname==='/api/v3/athlete/activities'&&req.method==='GET'){
    if(!authorized||req.headers.authorization!=='Bearer threshold-local-fixture-access'){
      res.statusCode=401;res.end(JSON.stringify({message:'Authorization required'}));return;
    }
    const after=Number(url.searchParams.get('after'))||0,page=Number(url.searchParams.get('page'))||1;
    res.end(JSON.stringify(page===1&&Date.parse(activity.start_date)/1000>after?[activity]:[]));return;
  }
  res.statusCode=404;res.end(JSON.stringify({message:'Unknown fixture route'}));
});
server.listen(3102,'127.0.0.1',()=>console.log('Synthetic Strava fixture ready on 127.0.0.1:3102; labelled local demo only.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
