import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { messagingFixture, athlete, owner, coach, other, workout, activity } from './helpers/messagingPg.mjs';
import { createMessagesHandler } from '../pages/api/coach/messages.js';
import { createMessageCenterHandler } from '../pages/api/message-center.js';
import { createNotificationsHandler } from '../pages/api/notifications.js';
import { getEffectiveAthleteIdFromRequest } from '../lib/auth/requireAthlete.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { clearSentDraft, messageDraftKey, readMessageDraft, writeMessageDraft } from '../lib/messageDrafts.js';
import { sanitizePreferences } from '../lib/notificationPreferences.js';
import { acknowledgeMessages } from '../lib/messageClient.js';

process.env.SESSION_COOKIE_SECRET = 'local-messaging-tests-secret-at-least-32-characters';
async function invoke(handler, actor, method='GET', body={}, query={}) {
  const req={method,body,query,headers:{cookie:actor ? `athlete_id=${encodeURIComponent(signAthleteSession(actor))}` : ''}};
  const res={code:200,setHeader(){},status(code){this.code=code;return this;},json(value){this.body=value;return this;},end(){}};
  await handler(req,res); return res;
}

test('messaging migration and signed handlers: delivery, scale, ownership, read races and preferences', async t => {
  const { pg, admin } = await messagingFixture();
  t.after(() => pg.close());
  const dependencies={getAdmin:()=>admin,getActor:getEffectiveAthleteIdFromRequest};
  const messages=createMessagesHandler(dependencies), center=createMessageCenterHandler(dependencies), notifications=createNotificationsHandler(dependencies);
  const send=(actor,text,id=randomUUID())=>invoke(messages,actor,'POST',{mode:actor===owner?'coach':'athlete',athlete_id:athlete,message_body:text,client_message_id:id});
  const summary=async actor=>(await invoke(center,actor,'GET',{}, {mode:actor===owner?'coach':'athlete'})).body;

  await t.test('migration repairs a missing direct table, preserves redacted history and protects service-only access', async () => {
    assert.equal((await pg.query('select body from account_notifications')).rows[0].body,'Open the conversation to read the reply.');
    const grants=(await pg.query(`select has_table_privilege('anon','account_notifications','select') as a,
      has_table_privilege('authenticated','coach_messages','insert') as b,
      has_function_privilege('anon','messaging_summary(uuid,text)','execute') as c,
      has_function_privilege('service_role','messaging_summary(uuid,text)','execute') as d`)).rows[0];
    assert.deepEqual(grants,{a:false,b:false,c:false,d:true});
    assert.equal((await invoke(messages,null)).code,401);
    await pg.exec('set role anon');
    await assert.rejects(pg.query('select public.messaging_summary($1,$2)',[athlete,'athlete']),/permission denied/);
    await assert.rejects(pg.query('select * from account_notifications'),/permission denied/);
    await pg.exec('reset role');
  });

  await t.test('service-role callers execute invoker delivery triggers without public privileges', async () => {
    await pg.exec('set role service_role');
    const id=randomUUID(); assert.equal((await send(athlete,'Service-role trigger check',id)).code,200);
    assert.equal((await pg.query('select count(*)::int as n from account_notifications where source_id=$1',[id])).rows[0].n,1);
    await pg.exec('reset role');
    await pg.query('delete from coach_messages where id=$1',[id]);
    assert.equal((await pg.query('select count(*)::int as n from account_notifications where source_id=$1',[id])).rows[0].n,0);
  });

  await t.test('both directions deliver once; replay and lost-response retry never duplicate notifications', async () => {
    const id=randomUUID();
    assert.equal((await send(athlete,'Private athlete reply',id)).code,200);
    assert.equal((await send(athlete,'Private athlete reply',id)).code,200);
    assert.equal((await send(athlete,'Changed replay',id)).code,500);
    assert.equal((await send(owner,'Private coach reply')).code,200);
    const rows=(await pg.query(`select * from account_notifications where source_kind='direct' order by recipient_id`)).rows;
    assert.equal(rows.length,2); assert.deepEqual(new Set(rows.map(r=>r.recipient_id)),new Set([athlete,owner]));
    assert.ok(rows.every(r=>!r.body.includes('Private')));
    assert.equal((await invoke(messages,other,'GET',{}, {athlete_id:athlete,mode:'coach'})).body.messages.length,0);
  });

  await t.test('delivery failure rolls back the message; retry after repair persists one message and one alert', async () => {
    const id=randomUUID();
    await pg.exec(`create function fail_delivery() returns trigger language plpgsql as $$ begin raise exception 'fixture delivery unavailable'; end $$;
      create trigger fixture_fail before insert on account_notifications for each row execute function fail_delivery();`);
    assert.equal((await send(athlete,'Keep this failed send',id)).code,500);
    assert.equal((await pg.query('select count(*)::int as n from coach_messages where id=$1',[id])).rows[0].n,0);
    await pg.exec('drop trigger fixture_fail on account_notifications; drop function fail_delivery();');
    assert.equal((await send(athlete,'Keep this failed send',id)).code,200);
    assert.equal((await pg.query('select count(*)::int as n from account_notifications where source_id=$1',[id])).rows[0].n,1);
  });

  await t.test('strict atomic preference patches preserve other keys and suppress only future notifications', async () => {
    assert.equal((await invoke(notifications,owner,'PATCH',{preferences:{athlete_message:'false'}})).code,400);
    assert.equal((await invoke(notifications,owner,'PATCH',{preferences:{unknown:false}})).code,400);
    assert.equal((await invoke(notifications,owner,'PATCH',{preferences:{athlete_message:false}})).code,200);
    assert.equal((await invoke(notifications,owner,'PATCH',{preferences:{workout_comment:false}})).body.preferences.athlete_message,false);
    const id=randomUUID(); assert.equal((await send(athlete,'Suppressed notification, delivered message',id)).code,200);
    assert.equal((await pg.query('select delivery_state from account_notifications where source_id=$1',[id])).rows[0].delivery_state,'suppressed');
    assert.equal((await invoke(notifications,owner,'PATCH',{preferences:{athlete_message:true,workout_comment:true}})).code,200);
    assert.equal((await pg.query('select delivery_state from account_notifications where source_id=$1',[id])).rows[0].delivery_state,'suppressed');
  });

  await t.test('legacy alert writers honor preferences without duplicating direct or session delivery', async () => {
    await invoke(notifications,owner,'PATCH',{preferences:{compliance_miss_alert:false}});
    const id=randomUUID();
    await pg.query(`insert into coach_notifications(id,coach_id,athlete_id,notification_type,title) values($1,$2,$3,'compliance_miss_alert','Compliance check')`,[id,coach,athlete]);
    assert.equal((await pg.query('select delivery_state from account_notifications where source_id=$1',[id])).rows[0].delivery_state,'suppressed');
    const obsolete=randomUUID();
    await pg.query(`insert into coach_notifications(id,coach_id,athlete_id,notification_type,title) values($1,$2,$3,'athlete_message','Obsolete side effect')`,[obsolete,coach,athlete]);
    assert.equal((await pg.query('select count(*)::int as n from account_notifications where source_id=$1',[obsolete])).rows[0].n,0);
  });

  await t.test('all-history counts exceed old 100/300/1000 limits and include old session threads', async () => {
    await pg.exec(`insert into coach_messages(coach_id,athlete_id,sender_role,message_body,created_at)
      select '${coach}','${athlete}','coach','History '||n,'2026-10-01T12:00:00Z' from generate_series(1,1105) n;
      insert into workout_comments(planned_workout_id,athlete_id,coach_id,sender_role,body,created_at)
      select '${workout}','${athlete}','${coach}','coach','Session '||n,'2026-09-01T12:00:00Z' from generate_series(1,135) n;
      insert into workout_comments(activity_id,athlete_id,coach_id,sender_role,body)
      values('${activity}','${athlete}','${coach}','coach','Private ride comment');`);
    const all=await summary(athlete); assert.equal(all.conversations[0].unread,1106); assert.equal(all.workout_threads.length,2);
    assert.equal(all.unread_total,1242); assert.equal(all.workout_threads.find(r=>r.subject_type==='workout').unread,135);
    assert.equal(all.workout_threads.find(r=>r.subject_type==='activity').sport,'bike');
    assert.equal(all.workout_threads.find(r=>r.subject_type==='activity').date,'2026-10-07');
    const inbox=await invoke(messages,athlete); assert.equal(inbox.body.conversations[0].unread_count,1106);
    assert.equal(inbox.body.messages.length,50); assert.ok(inbox.body.next_cursor);
    const feed=await invoke(notifications,athlete); assert.equal(feed.body.notifications.length,50); assert.equal(feed.body.unread_count,1242); assert.ok(feed.body.next_cursor);
    const older=await invoke(notifications,athlete,'GET',{}, {before:feed.body.next_cursor});
    assert.equal(new Set([...feed.body.notifications,...older.body.notifications].map(n=>n.id)).size,100);
  });

  await t.test('loaded-only acknowledgement leaves new arrivals and old unread history intact; synchronizes alerts', async () => {
    const loaded=(await invoke(messages,athlete)).body.messages;
    const unreadLoaded=loaded.filter(m=>m.sender_role==='coach' && !m.read_at).length;
    const arrived=randomUUID(); await send(owner,'Arrived after load',arrived);
    const ack=await invoke(center,athlete,'POST',{action:'mark_read',scope:'conversation',message_ids:loaded.map(m=>m.id)});
    assert.equal(ack.code,200); assert.equal((await summary(athlete)).conversations[0].unread,1107-unreadLoaded);
    assert.equal(ack.body.conversations[0].unread_count,1107-unreadLoaded);
    assert.equal((await pg.query('select read_at from coach_messages where id=$1',[arrived])).rows[0].read_at,null);
    assert.equal((await invoke(notifications,athlete)).body.unread_count,1243-unreadLoaded);
    const comment=(await pg.query('select id from workout_comments where planned_workout_id=$1 limit 1',[workout])).rows[0].id;
    assert.equal((await invoke(center,athlete,'POST',{action:'mark_read',scope:'workout',workout_id:workout})).code,400);
    assert.equal((await invoke(center,athlete,'POST',{action:'mark_read',scope:'workout',workout_id:workout,comment_ids:[comment]})).code,200);
    assert.equal((await summary(athlete)).workout_threads.find(r=>r.subject_id===workout).unread,134);
    assert.equal((await invoke(center,other,'POST',{action:'mark_read',scope:'workout',workout_id:workout,comment_ids:[comment]})).code,403);
  });

  await t.test('feed acknowledgements are owner-scoped, idempotent and never mark unseen arrivals or source messages', async () => {
    const feed=(await invoke(notifications,athlete)).body;
    const ids=feed.notifications.filter(n=>!n.read_at).map(n=>n.id);
    const arrived=randomUUID(); await send(owner,'Arrived after feed snapshot',arrived);
    const before=(await invoke(notifications,athlete)).body.unread_count;
    assert.equal((await invoke(notifications,other,'PATCH',{mark_read:true,notification_ids:ids})).code,200);
    assert.equal((await invoke(notifications,athlete)).body.unread_count,before);
    assert.equal((await invoke(notifications,athlete,'PATCH',{mark_read:true})).code,400);
    for (let n=0;n<2;n++) assert.equal((await invoke(notifications,athlete,'PATCH',{mark_read:true,notification_ids:ids})).code,200);
    assert.equal((await invoke(notifications,athlete)).body.unread_count,before-ids.length);
    assert.equal((await pg.query('select read_at from account_notifications where source_id=$1',[arrived])).rows[0].read_at,null);
    assert.equal((await pg.query('select read_at from coach_messages where id=$1',[arrived])).rows[0].read_at,null);
  });

  await t.test('revoked relationships disappear from summary and feed and deny sends/read acknowledgements', async () => {
    await pg.exec("update coach_athlete_relationships set status='inactive'");
    assert.equal((await summary(owner)).unread_total,0); assert.equal((await summary(athlete)).unread_total,0);
    assert.equal((await invoke(notifications,athlete)).body.unread_count,0);
    assert.equal((await send(owner,'Revoked')).code,403); assert.equal((await send(athlete,'Revoked')).code,403);
    await assert.rejects(pg.query(`insert into coach_messages(coach_id,athlete_id,sender_role,message_body) values($1,$2,'coach','Bypass route')`,[coach,athlete]),/Active coaching relationship required/);
    assert.equal((await invoke(center,owner,'POST',{mode:'coach',action:'mark_read',scope:'conversation',athlete_id:athlete,message_ids:[randomUUID()]})).code,403);
    await pg.exec(`update athletes set session_version=2 where id='${athlete}'`);
    assert.equal((await invoke(notifications,athlete)).code,401);
  });
});

test('draft storage isolates accounts, modes, conversations and replacement coaches; retains retry identity and expires', () => {
  const entries=new Map(); const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const conversation={coach_id:coach,athlete_id:athlete};
  const key=messageDraftKey(owner,'coach',conversation); const draft={body:'Save my draft',templateKey:'general_checkin',retry:{id:randomUUID(),signature:'signature'}};
  const now=Date.now();
  assert.equal(writeMessageDraft(storage,key,draft,now),true);
  assert.deepEqual(readMessageDraft(storage,key,now+1).draft,{...draft,savedAt:now});
  assert.equal(clearSentDraft(storage,key,'different-retry'),false);
  assert.equal(readMessageDraft(storage,key,now+1).draft.body,draft.body);
  for (const different of [messageDraftKey(athlete,'coach',conversation),messageDraftKey(owner,'athlete',conversation),messageDraftKey(owner,'coach',{...conversation,coach_id:other})]) assert.equal(readMessageDraft(storage,different).draft,null);
  assert.equal(readMessageDraft(storage,key,now+31*24*60*60*1000).draft,null);
  const failing={getItem(){throw new Error('Denied');},setItem(){throw new Error('Full');}};
  assert.equal(readMessageDraft(failing,key).ok,false); assert.equal(writeMessageDraft(failing,key,draft),false);
  assert.equal(messageDraftKey(null,'coach',conversation),null);
  assert.equal(sanitizePreferences({athlete_message:'false'}),null);
});

test('hidden messages do not clear unread badges and failed acknowledgement keeps the count intact', async t => {
  const previous=globalThis.document; globalThis.document={visibilityState:'hidden'};
  t.after(()=>{globalThis.document=previous;});
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:'Failed'},{status:503}));
  const rows=[{id:randomUUID(),sender_role:'coach',read_at:null}];
  assert.equal(await acknowledgeMessages(rows,'athlete',athlete),0);
  globalThis.document.visibilityState='visible';
  assert.equal(await acknowledgeMessages(rows,'athlete',athlete),false);
});
