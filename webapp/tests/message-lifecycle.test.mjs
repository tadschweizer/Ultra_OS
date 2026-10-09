import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, response, owner, athlete, stranger, coach, plan, message, otherMessage } from './helpers/message-lifecycle-fixture.mjs';
import { createMessageEmailWorker } from '../pages/api/messages/deliver-pending.js';
import { sendMessageNotificationEmail } from '../lib/email/transactional.js';

test('signed API persists message + notification atomically, retries once, and rejects changed replay or revoked relationship',async()=>{
  const f=await fixture();try{
    await f.pg.exec(`insert into message_preferences(athlete_id,email_enabled) values('${owner}',true),('${athlete}',true);`);
    let r=await f.send(message,'athlete');assert.equal(r.code,200,JSON.stringify(r.body));
    r=await f.send(message,'athlete');assert.equal(r.body.replayed,true);
    assert.equal((await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n,1);
    assert.equal((await f.pg.query('select count(*)::int n from message_email_deliveries')).rows[0].n,1);
    assert.equal((await f.pg.query('select count(*)::int n from coach_notifications')).rows[0].n,1);
    assert.equal((await f.send(message,'athlete','different')).code,409);
    await f.pg.exec("update coach_athlete_relationships set status='revoked';");
    assert.equal((await f.send(message,'athlete')).code,403);
  }finally{await f.close();}
});

test('outbox failure rolls back the entire send and preserves its saved draft for retry',async()=>{
  const f=await fixture();try {
    await f.invoke('draft',{method:'PUT',body:{mode:'coach',athlete_id:athlete,body:'Keep draft',client_message_id:message}});
    await f.pg.exec(`reset role;create function public.reject_outbox() returns trigger language plpgsql as $$begin raise exception 'Isolated outbox failure';end$$;
      create trigger reject_outbox before insert on message_email_deliveries for each row execute function public.reject_outbox();set role service_role;`);
    assert.equal((await f.send(message,'coach','Keep draft')).code,503);
    assert.equal((await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n,0);
    assert.equal((await f.invoke('draft',{query:{athlete_id:athlete}})).body.draft.body,'Keep draft');
    await f.pg.exec('reset role;drop trigger reject_outbox on message_email_deliveries;set role service_role;');
    assert.equal((await f.send(message,'coach','Keep draft')).code,200);
  }finally{await f.close();}
});

test('drafts survive new signed requests, fence stale tabs, replay a lost save, and clear only the successfully sent draft',async()=>{
  const f=await fixture();try{
    const body={mode:'coach',athlete_id:athlete,body:'Keep draft',client_message_id:message};
    const r=await f.invoke('draft',{method:'PUT',body});assert.equal(r.code,200,JSON.stringify(r.body));const v=r.body.draft.version;
    assert.equal((await f.invoke('draft',{query:{mode:'coach',athlete_id:athlete}})).body.draft.body,'Keep draft');
    assert.equal((await f.invoke('draft',{method:'PUT',body})).body.draft.version,v);
    assert.equal((await f.invoke('draft',{method:'PUT',body:{...body,body:'Stale tab'}})).code,409);
    const saved=await f.invoke('draft',{method:'PUT',body:{...body,body:'Keep draft',expected_version:v}});
    assert.equal(saved.code,200);
    assert.equal((await f.send(message,'coach','Keep draft')).code,200);
    assert.equal((await f.invoke('draft',{query:{athlete_id:athlete}})).body.draft,null);
    assert.equal((await f.invoke('draft',{method:'PUT',body:{...body,client_message_id:null,expected_version:saved.body.draft.version}})).code,409);
    assert.equal((await f.invoke('draft',{method:'PUT',body:{...body,expected_version:saved.body.draft.version}})).code,200);
    assert.equal((await f.send(message,'coach','Keep draft')).body.replayed,true);
    assert.equal((await f.invoke('draft',{query:{athlete_id:athlete}})).body.draft,null);
  }finally{await f.close();}
});

test('drafts, preferences and messages reject unauthenticated, revoked sessions, cross origin and foreign athlete before a write',async()=>{
  const f=await fixture();try{
    for(const route of ['draft','preferences','messages','center'])assert.equal((await f.invoke(route,{actor:null})).code,401);
    const b={mode:'coach',athlete_id:stranger,body:'private'};
    assert.equal((await f.invoke('draft',{method:'PUT',body:b})).code,403);
    assert.equal((await f.invoke('draft',{actor:stranger,query:{mode:'coach',athlete_id:athlete}})).code,403);
    assert.equal((await f.invoke('draft',{method:'PUT',body:{...b,athlete_id:athlete},origin:'https://attacker.example'})).code,403);
    assert.equal((await f.invoke('preferences',{method:'PUT',body:{email_enabled:'false',badge_enabled:true}})).code,400);
    await f.pg.exec(`update athletes set session_version=2 where id='${owner}';`);
    assert.equal((await f.invoke('draft',{query:{athlete_id:athlete}})).code,401);
    assert.equal((await f.pg.query('select count(*)::int n from message_drafts')).rows[0].n,0);
  }finally{await f.close();}
});

test('SQL summary counts unread beyond 1000 direct messages and 120 comments while bounding previews and excluding revoked athletes',async()=>{
  const f=await fixture();try{
    await f.pg.exec(`insert into coach_messages(coach_id,athlete_id,sender_role,message_body,created_at)
      select '${coach}','${athlete}','athlete','Old unread',now()-interval '1 day'*n from generate_series(1,1105) n;
      insert into coach_messages(coach_id,athlete_id,sender_role,message_body,created_at,read_at) values('${coach}','${athlete}','coach','Latest read',now(),now());
      insert into workout_comments(athlete_id,planned_workout_id,sender_role,body) select '${athlete}','${plan}','athlete','Comment' from generate_series(1,125);
      insert into coach_messages(coach_id,athlete_id,sender_role,message_body) values('${coach}','${stranger}','athlete','No relationship');`);
    const center=await f.invoke('center',{query:{mode:'coach'}});assert.equal(center.code,200,JSON.stringify(center.body));
    assert.equal(center.body.unread_total,1230);assert.equal(center.body.conversations[0].unread,1105);
    assert.equal(center.body.workout_threads[0].unread,125);assert.equal(center.body.conversations[0].last_message.message_body,'Latest read');
    const inbox=await f.invoke('messages',{query:{mode:'coach',athlete_id:athlete}});
    assert.equal(inbox.body.conversations[0].unread_count,1105);assert.equal(inbox.body.messages.length,50);assert.ok(inbox.body.next_cursor);
    const ids=inbox.body.messages.filter(m=>m.sender_role==='athlete').map(m=>m.id);
    assert.equal((await f.invoke('center',{method:'POST',body:{mode:'coach',action:'mark_read',scope:'conversation',athlete_id:athlete,message_ids:ids}})).code,200);
    assert.equal((await f.invoke('center',{query:{mode:'coach'}})).body.unread_total,1230-ids.length);
  }finally{await f.close();}
});

test('preferences are owned and durable; badge opt-out preserves unread counts and email starts disabled',async()=>{
  const f=await fixture();try{
    assert.deepEqual((await f.invoke('preferences')).body.preferences,{email_enabled:false,badge_enabled:true});
    await f.send(message,'athlete');
    let r=await f.invoke('preferences',{method:'PUT',body:{email_enabled:true,badge_enabled:false,athlete_id:stranger}});assert.equal(r.code,200);
    r=await f.invoke('center',{query:{mode:'coach'}});assert.equal(r.body.badge_enabled,false);assert.equal(r.body.unread_total,1);
    assert.equal((await f.invoke('preferences',{actor:stranger})).body.preferences.email_enabled,false);
    assert.equal((await f.pg.query('select status from message_email_deliveries')).rows[0].status,'skipped');
  }finally{await f.close();}
});

test('queue claims one lease, fences stale workers, retries outage, and suppresses read, disabled or revoked notifications',async()=>{
  const f=await fixture();try{
    await f.pg.exec(`insert into message_preferences(athlete_id,email_enabled) values('${athlete}',true);`);
    await f.send();let job=await f.rpc('claim_message_email');assert.equal(job.email,'runner@example.test');
    assert.equal(await f.rpc('claim_message_email'),null);
    assert.equal(await f.rpc('finish_message_email',{p_message:message,p_lease:otherMessage,p_outcome:'sent',p_provider:'provider',p_failure:null}),false);
    assert.equal(await f.rpc('finish_message_email',{p_message:message,p_lease:job.lease_token,p_outcome:'retry',p_provider:null,p_failure:'provider_unavailable'}),true);
    await f.pg.exec("update message_email_deliveries set available_at=now();update coach_messages set read_at=now();");
    assert.equal((await f.rpc('claim_message_email')).skipped,true);
    assert.equal((await f.pg.query('select failure_category from message_email_deliveries')).rows[0].failure_category,'already_read');
    await f.send(otherMessage);await f.pg.exec('update message_preferences set email_enabled=false;');
    assert.equal((await f.rpc('claim_message_email')).skipped,true);
    await f.pg.exec('update message_preferences set email_enabled=true;');
    const third='88888888-8888-4888-8888-888888888888';await f.send(third);await f.pg.exec("update coach_athlete_relationships set status='revoked';");
    assert.equal((await f.rpc('claim_message_email')).skipped,true);
  }finally{await f.close();}
});

test('worker authenticates before database access and provider acceptance is saved without returning recipient details',async()=>{
  const f=await fixture();try{
    await f.pg.exec(`insert into message_preferences(athlete_id,email_enabled) values('${athlete}',true);`);await f.send();
    let calls=0;const secret='worker-test-secret-with-at-least-32-chars';
    const worker=createMessageEmailWorker({getClient:()=>{calls++;return f.admin;},secret:()=>secret,send:async payload=>{assert.equal(payload.messageId,message);assert.equal(payload.body,undefined);return {ok:true,providerId:'accepted-1'};}});
    let r=response();await worker({method:'POST',headers:{authorization:'Bearer bad'}},r);assert.equal(r.code,401);assert.equal(calls,0);
    r=response();await worker({method:'POST',headers:{authorization:`Bearer ${secret}`}},r);assert.equal(r.code,200,JSON.stringify(r.body));assert.equal(r.body.sent,1);
    assert.equal(JSON.stringify(r.body).includes('runner@'),false);
    assert.equal((await f.pg.query('select status,provider_id from message_email_deliveries')).rows[0].status,'sent');
  }finally{await f.close();}
});

test('new tables and actor-parameter functions are service-role-only; account deletion cascades private drafts and delivery records',async()=>{
  const f=await fixture();try{
    for(const role of ['anon','authenticated']){
      await f.pg.exec('reset role');
      for(const table of ['message_drafts','message_preferences','message_email_deliveries']) {
        assert.equal((await f.pg.query('select has_table_privilege($1,$2,\'select\') allowed',[role,table])).rows[0].allowed,false);
        assert.equal((await f.pg.query('select relrowsecurity from pg_class where relname=$1',[table])).rows[0].relrowsecurity,true);
      }
      assert.equal((await f.pg.query("select has_function_privilege($1,'public.message_inbox_summary(uuid,text)','execute') allowed",[role])).rows[0].allowed,false);
      await f.pg.exec(`set role ${role}`);await assert.rejects(f.pg.query('select public.message_inbox_summary($1,$2)',[owner,'coach']),/permission denied/);
    }
    await f.pg.exec('reset role;set role service_role;');await f.send();
    await f.invoke('draft',{method:'PUT',body:{mode:'coach',athlete_id:athlete,body:'Private draft'}});
    await f.pg.exec('reset role;');
    // Existing relationship fixture lacks its production cascade; remove that prerequisite row first.
    await f.pg.exec(`delete from coach_athlete_relationships;delete from athletes where id='${athlete}';`);
    assert.equal((await f.pg.query('select count(*)::int n from message_drafts')).rows[0].n,0);
    assert.equal((await f.pg.query('select count(*)::int n from message_email_deliveries')).rows[0].n,0);
  }finally{await f.close();}
});

test('notification sender uses a stable provider idempotency key and generic private-content-free email',async(t)=>{
  process.env.RESEND_API_KEY='isolated-provider-key';let sent;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{sent=init;return Response.json({id:'provider-1'});});
  const result=await sendMessageNotificationEmail({email:'recipient@example.test',messageId:message,mode:'athlete',athleteId:athlete});
  assert.equal(result.ok,true);assert.equal(sent.headers['Idempotency-Key'],`threshold-message/${message}`);
  const payload=JSON.parse(sent.body);assert.equal(payload.subject,'New message in Threshold');assert.match(payload.html,/Sign in/);assert.doesNotMatch(payload.html,/Private training details/);
  delete process.env.RESEND_API_KEY;
});

test('provider throttling, concurrent retries and outages remain retryable; invalid requests fail permanently',async(t)=>{
  process.env.RESEND_API_KEY='isolated-provider-key';
  try {
    for(const status of [408,409,429,503,422,403]) {
      const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({error:'isolated'},{status}));
      const result=await sendMessageNotificationEmail({email:'recipient@example.test',messageId:message,mode:'athlete',athleteId:athlete});
      assert.equal(result.failureCategory,[422,403].includes(status)?'provider_rejected':'provider_unavailable');mock.mock.restore();
    }
  }finally{delete process.env.RESEND_API_KEY;}
});

test('queue bounds uncertain provider retries and suppresses unverified recipients and expired jobs',async()=>{
  const f=await fixture();try {
    await f.pg.exec(`insert into message_preferences(athlete_id,email_enabled) values('${athlete}',true);`);
    await f.send();await f.pg.exec(`update athletes set email_verified_at=null where id='${athlete}';`);
    assert.equal((await f.rpc('claim_message_email')).skipped,true);
    assert.equal((await f.pg.query('select failure_category from message_email_deliveries')).rows[0].failure_category,'unverified_email');
    await f.pg.exec(`update athletes set email_verified_at=now() where id='${athlete}';`);
    await f.send(otherMessage);await f.pg.exec(`update message_email_deliveries set expires_at=now()-interval '1 second' where message_id='${otherMessage}';`);
    assert.equal((await f.rpc('claim_message_email')).skipped,true);
    assert.equal((await f.pg.query('select failure_category from message_email_deliveries where message_id=$1',[otherMessage])).rows[0].failure_category,'expired');
    const id='88888888-8888-4888-8888-888888888888';await f.send(id);
    for(let n=1;n<=5;n++) {
      const job=await f.rpc('claim_message_email');assert.equal(job.message_id,id);
      await assert.rejects(f.rpc('finish_message_email',{p_message:id,p_lease:job.lease_token,p_outcome:null,p_provider:null,p_failure:null}),/Invalid outcome/);
      await f.rpc('finish_message_email',{p_message:id,p_lease:job.lease_token,p_outcome:'retry',p_provider:null,p_failure:'provider_unavailable'});
      await f.pg.exec(`update message_email_deliveries set available_at=now() where message_id='${id}';`);
    }
    assert.equal(await f.rpc('claim_message_email'),null);
    const row=(await f.pg.query('select attempts,status from message_email_deliveries where message_id=$1',[id])).rows[0];
    assert.deepEqual(row,{attempts:5,status:'failed'});
  }finally{await f.close();}
});
