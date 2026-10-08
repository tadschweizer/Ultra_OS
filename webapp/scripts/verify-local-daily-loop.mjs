// Disposable records only, in the named local QA stack. No production fallback.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.js`, context); throw error; }
} });
const status = JSON.parse(execFileSync('supabase.exe', ['status', '--workdir', '../output/p010-012-supabase', '-o', 'json'], { encoding:'utf8', stdio:['ignore','pipe','ignore'] }));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1');
process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
process.env.SESSION_COOKIE_SECRET = crypto.randomBytes(32).toString('hex');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { signAthleteSession } = await import('../lib/auth/sessionCookies.js');
const { default: workouts } = await import('../pages/api/planned-workouts.js');
const { default: messages } = await import('../pages/api/coach/messages.js');
const { default: center } = await import('../pages/api/message-center.js');
const checks=[]; const ids=[];
const checked = async promise => { const r=await promise; if(r.error) throw r.error; return r.data; };
const pass = name => { checks.push(name); console.log(`PASS: ${name}`); };
async function invoke(handler, actor, method, body={}, query={}) {
  const req={method,body,query,headers:{origin:'http://localhost:3000','content-type':'application/json',cookie:actor ? `athlete_id=${encodeURIComponent(signAthleteSession(actor))}` : ''}};
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;}};
  await handler(req,res); return res;
}
try {
  const people=await checked(admin.from('athletes').insert([
    {name:'Daily loop local coach',primary_role:'coach',subscription_tier:'coach_pro'},
    {name:'Daily loop local athlete',primary_role:'athlete',subscription_tier:'free'}, {name:'Daily loop unrelated athlete',primary_role:'athlete',subscription_tier:'free'},
  ]).select('id'));
  ids.push(...people.map(p=>p.id)); const [coach,athlete,other]=ids;
  const profile=await checked(admin.from('coach_profiles').insert({athlete_id:coach,display_name:'Local coach',coach_code:`LOOP-${crypto.randomUUID().slice(0,8)}`}).select().single());
  await checked(admin.from('coach_athlete_relationships').insert({coach_id:profile.id,athlete_id:athlete,status:'active'}));
  const workoutPayload={client_request_id:crypto.randomUUID(),athlete_id:athlete,title:'Assigned easy run',workout_date:'2026-10-04',sport:'run',planned_duration_min:60};
  const created=await invoke(workouts,coach,'POST',workoutPayload);
  assert.equal(created.code,200,JSON.stringify(created.body)); const workout=created.body.workout;
  const workoutRetry=await invoke(workouts,coach,'POST',workoutPayload);
  assert.equal(workoutRetry.code,200,JSON.stringify(workoutRetry.body)); assert.equal(workoutRetry.body.workout.id,workout.id);
  assert.equal((await invoke(workouts,coach,'POST',{...workoutPayload,title:'Changed draft'})).code,409);
  assert.equal((await invoke(workouts,other,'PATCH',{id:workout.id,status:'completed'})).code,403);
  assert.equal((await invoke(workouts,athlete,'PATCH',{id:workout.id,title:'Overwrite coach plan'})).code,400);
  assert.equal((await invoke(workouts,athlete,'PATCH',{id:workout.id,status:'completed',completed_duration_min:-1})).code,400);
  for(const duration of [20,25]) assert.equal((await invoke(workouts,athlete,'PATCH',{id:workout.id,status:'completed',completed_duration_min:duration,completed_distance_km:null})).code,200);
  assert.equal((await checked(admin.from('planned_workouts').select().eq('id',workout.id).single())).completed_duration_min,25);
  assert.equal((await invoke(workouts,athlete,'PATCH',{id:workout.id,status:'planned',completed_duration_min:null,completed_distance_km:null})).code,200);
  pass('Real signed-session workout create, partial actuals, correction, undo, numeric validation and cross-athlete denial');
  const unplanned=await invoke(workouts,athlete,'POST',{title:'Unplanned walk',workout_date:'2026-10-04',sport:'hike',status:'completed',completed_duration_min:18});
  assert.equal(unplanned.code,200); assert.equal(unplanned.body.workout.completed_duration_min,18); assert.equal(unplanned.body.workout.planned_duration_min,null);
  pass('Unplanned completion persists without invented planned totals');
  const clientId=crypto.randomUUID(); const payload={message_body:'How did it feel?',athlete_id:athlete,client_message_id:clientId};
  for(let i=0;i<2;i++) { const reply=await invoke(messages,coach,'POST',payload); assert.equal(reply.code,200,JSON.stringify(reply.body)); assert.equal(reply.body.message.id,clientId); }
  assert.equal((await checked(admin.from('coach_messages').select('id').eq('id',clientId))).length,1);
  assert.equal((await invoke(messages,other,'GET',{}, {athlete_id:athlete,mode:'coach'})).body.messages.length,0);
  pass('Durable message retry returns one row; unrelated athlete cannot read the conversation');
  const rows=Array.from({length:61},(_,i)=>({id:crypto.randomUUID(),coach_id:profile.id,athlete_id:athlete,sender_role:'coach',message_body:`History ${i}`,created_at:'2026-10-04T10:00:00Z'}));
  await checked(admin.from('coach_messages').insert(rows));
  const first=await invoke(messages,athlete,'GET'); assert.equal(first.code,200); assert.equal(first.body.messages.length,50); assert.ok(first.body.next_cursor);
  const second=await invoke(messages,athlete,'GET',{}, {before:first.body.next_cursor}); assert.equal(second.code,200); assert.equal(second.body.messages.length,12);
  assert.equal(new Set([...first.body.messages,...second.body.messages].map(m=>m.id)).size,62);
  pass('Real PostgREST cursor pagination preserves 62 messages including timestamp ties');
  const seen=first.body.messages.map(m=>m.id);
  const ack=await invoke(center,athlete,'POST',{action:'mark_read',scope:'conversation',message_ids:seen}); assert.equal(ack.code,200,JSON.stringify(ack.body));
  const unread=await checked(admin.from('coach_messages').select('id').eq('athlete_id',athlete).is('read_at',null)); assert.equal(unread.length,12);
  pass('Acknowledgement changes only the 50 loaded messages and leaves unseen history unread');
  await checked(admin.from('coach_athlete_relationships').update({status:'removed'}).eq('coach_id',profile.id).eq('athlete_id',athlete));
  assert.equal((await invoke(messages,coach,'POST',payload)).code,403);
  assert.equal((await invoke(messages,coach,'GET',{}, {athlete_id:athlete})).code,403);
  assert.equal((await invoke(center,coach,'POST',{action:'mark_read',scope:'conversation',athlete_id:athlete,message_ids:[clientId]})).code,403);
  assert.equal((await invoke(workouts,coach,'PATCH',{id:workout.id,title:'Revoked edit'})).code,403);
  pass('Revocation denies message read, retry, acknowledgement and workout edit');
} finally {
  if(ids.length) await checked(admin.from('athletes').delete().in('id',ids));
  await writeFile('../output/p0-daily-loop-local-acceptance.json',JSON.stringify({environment:'isolated local Supabase; signed handlers and real PostgREST',checks,cleaned:true},null,2));
}
