import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { calendarFixture, migration, owner, athlete, coach, plan, stranger } from './helpers/calendar-gap-fixture.mjs';
import { client, response } from './helpers/message-lifecycle-fixture.mjs';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { createCoachingSettingsHandler } from '../pages/api/coaching-notification-settings.js';
import { createNotificationPhoneHandler } from '../pages/api/coaching-notifications/phone.js';
import { createCoachingWorker } from '../pages/api/coaching-notifications/deliver-pending.js';
import { validTwilioSignature, createSmsEventsHandler } from '../pages/api/coaching-notifications/sms-events.js';
import { twilioRequest, deliverCoachingNotification } from '../lib/coachingNotificationDelivery.js';
import { validateCoachingPreferences, EMPTY_COACHING_PREFERENCES } from '../lib/coachingNotifications.js';

const secret = 'coaching-worker-test-secret-at-least-32-characters';
async function fixture() {
  const f = await calendarFixture();
  await f.pg.exec('reset role');
  await f.pg.exec(migration('20261016034417_security_boundary_hardening.sql'));
  await f.pg.exec("update planned_workouts set visibility='athlete_visible',status='planned'");
  await f.pg.exec(migration('20261028165342_coaching_notifications.sql'));
  await f.pg.exec(`update athletes set email=id::text||'@example.test', email_verified_at=now(); set role service_role;`);
  const admin = client(f.pg);
  const rpc = async (name, args = {}) => { const result = await admin.rpc(name, args); if (result.error) throw result.error; return result.data; };
  const enable = async id => {
    await rpc('save_coaching_notification_preferences', { p_owner: id, p_patch: Object.fromEntries(Object.keys(EMPTY_COACHING_PREFERENCES).map(k => [k, true])) });
    await f.pg.query("update coaching_notification_settings set phone='+18015551234',phone_verified_at=now(),sms_consent_at=now() where athlete_id=$1", [id]);
  };
  const upload = async (age = '0 hours', id = randomUUID()) => {
    await f.pg.query("insert into strava_activities(id,athlete_id,strava_activity_id,start_date) values($1,$2,$3,now()-$4::interval) on conflict(id) do update set name='updated'", [id, athlete, id, age]); return id;
  };
  const claim = channel => rpc('claim_coaching_notification', { p_channel: channel });
  return { ...f, admin, rpc, enable, upload, claim };
}

test('actual activity inserts notify only opted-in active coaches, ignore historical imports and duplicate upserts', async () => {
  const f = await fixture(); try {
    await f.upload(); assert.equal(await f.claim('email'), null);
    await f.enable(owner); await f.upload('72 hours'); assert.equal(await f.claim('email'), null);
    const id = await f.upload(); await f.upload('0 hours', id);
    const job = await f.claim('sms'); assert.equal(job.event, 'workout_completed'); assert.equal(job.mode, 'coach');
    assert.equal(await f.claim('sms'), null);
    assert.equal(await f.rpc('finish_coaching_notification', { p_id: job.id, p_lease: randomUUID(), p_outcome: 'accepted' }), false);
    assert.equal(await f.rpc('finish_coaching_notification', { p_id: job.id, p_lease: job.lease_token, p_outcome: 'accepted' }), true);
    await f.pg.exec("update coach_athlete_relationships set status='removed'");
    assert.equal((await f.claim('email')).skipped, true);
  } finally { await f.close(); }
});

test('assignments, publishing drafts, manual completion and two-way comments generate the right events', async () => {
  const f = await fixture(); try {
    await f.enable(owner); await f.enable(athlete);
    const draft = randomUUID();
    await f.pg.query("insert into planned_workouts(id,athlete_id,coach_id,title,workout_date,visibility) values($1,$2,$3,'Draft',current_date+7,'coach_private')", [draft, athlete, coach]);
    assert.equal(await f.claim('email'), null);
    await f.pg.query("update planned_workouts set visibility='athlete_visible' where id=$1", [draft]);
    assert.equal((await f.claim('email')).event, 'workout_assigned');
    await f.pg.query("update planned_workouts set title='Edited' where id=$1", [draft]);
    assert.equal(await f.claim('email'), null);
    await f.pg.query("update planned_workouts set status='completed' where id=$1", [plan]);
    assert.equal((await f.claim('email')).event, 'workout_completed');
    for (const [sender, author, mode] of [['coach', owner, 'athlete'], ['athlete', athlete, 'coach']]) {
      await f.pg.query('insert into workout_comments(planned_workout_id,athlete_id,coach_id,author_athlete_id,sender_role,body) values($1,$2,$3,$4,$5,$6)', [plan, athlete, coach, author, sender, 'Private content']);
      const job = await f.claim('email'); assert.equal(job.event, 'workout_comment'); assert.equal(job.mode, mode); assert.equal(JSON.stringify(job).includes('Private content'), false);
    }
  } finally { await f.close(); }
});

test('delivery rechecks opt-out, verified email, phone consent and source visibility; expired SMS leases are never resent', async () => {
  const f = await fixture(); try {
    await f.enable(owner); await f.upload();
    await f.rpc('save_coaching_notification_preferences', { p_owner: owner, p_patch: { workout_completed_email: false } });
    assert.equal((await f.claim('email')).skipped, true);
    await f.pg.exec("update coaching_notification_settings set sms_stopped_at=now()");
    assert.equal((await f.claim('sms')).skipped, true);
    await f.pg.exec("update coaching_notification_settings set sms_stopped_at=null");
    await f.upload(); await f.claim('sms');
    await f.pg.exec("update coaching_notification_deliveries set available_at=now()-interval '3 minutes' where status='processing'");
    assert.equal((await f.claim('sms')).skipped, true);
    assert.equal((await f.pg.query("select count(*)::int n from coaching_notification_deliveries where status='uncertain'")).rows[0].n, 1);
    await f.enable(athlete);
    await f.pg.query("insert into planned_workouts(athlete_id,coach_id,title,workout_date) values($1,$2,'New',current_date+7)", [athlete, coach]);
    await f.pg.exec("update planned_workouts set visibility='coach_private'");
    assert.equal((await f.claim('email')).skipped, true);
    await f.enable(owner); await f.upload();
    await f.pg.query('update athletes set email_verified_at=null where id=$1', [owner]);
    assert.equal((await f.claim('email')).skipped, true);
  } finally { await f.close(); }
});

test('settings API is owner-scoped, validates booleans, rejects stale sessions and cross-origin writes, and preserves other switches', async () => {
  const f = await fixture(); try {
    const handler = createCoachingSettingsHandler({ getClient: () => f.admin, availability: () => ({ email: true, sms: true }) });
    const invoke = async (body, { actor = owner, version = 1, origin = 'http://localhost:3000', method = 'PATCH' } = {}) => {
      const res = response(); await handler({ method, body, headers: { origin, 'content-type': 'application/json', cookie: actor ? `athlete_id=${signAthleteSession(actor, version)}` : '' } }, res); return res;
    };
    assert.equal((await invoke({ preferences: { workout_completed_email: 'false' } })).code, 400);
    assert.equal((await invoke({ preferences: { workout_completed_email: true } }, { origin: 'https://evil.test' })).code, 403);
    assert.equal((await invoke({}, { actor: null, method: 'GET' })).code, 401);
    assert.equal((await invoke({}, { version: 2, method: 'GET' })).code, 401);
    assert.equal((await invoke({ preferences: { workout_completed_sms: true } })).code, 400);
    assert.equal((await invoke({ athlete_id: stranger, preferences: { workout_completed_email: true } })).code, 200);
    const saved = await invoke({ preferences: { workout_comment_email: true } });
    assert.equal(saved.body.preferences.workout_completed_email, true);
    assert.equal((await f.pg.query('select athlete_id from coaching_notification_settings')).rows[0].athlete_id, owner);
    await f.pg.exec('reset role; set role authenticated');
    await assert.rejects(f.pg.query('select * from coaching_notification_settings'), /permission denied/);
    await assert.rejects(f.pg.query("select claim_coaching_notification('email')"), /permission denied/);
  } finally { await f.close(); }
});

test('worker requires secret and records provider acceptance without claiming handset delivery', async () => {
  const f = await fixture(); try {
    await f.enable(owner); await f.upload(); let calls = 0;
    const handler = createCoachingWorker({ getClient: () => f.admin, secret: () => secret, availability: () => ({ email: true, sms: false }), send: async () => { calls++; return { outcome: 'accepted', providerId: 'test' }; } });
    let res = response(); await handler({ method: 'POST', headers: {} }, res); assert.equal(res.code, 401); assert.equal(calls, 0);
    res = response(); await handler({ method: 'POST', headers: { authorization: `Bearer ${secret}` } }, res);
    assert.equal(res.code, 200); assert.equal(res.body.accepted, 1); assert.equal(calls, 1);
  } finally { await f.close(); }
});

test('provider transport does not automatically retry ambiguous SMS results; webhook signature covers every field and configured URL', async () => {
  const env = { TWILIO_AUTH_TOKEN: 'token', TWILIO_ACCOUNT_SID: 'ACtest' };
  const result = await twilioRequest('Messages', { To: '+18015551234' }, { env, fetcher: async () => { throw new Error('timeout'); } });
  assert.equal(result.outcome, 'uncertain');
  const url = 'https://threshold.example/api/coaching-notifications/sms-events', body = { From: '+18015551234', Body: 'STOP' };
  const signature = createHmac('sha1', 'token').update(url + 'BodySTOPFrom+18015551234').digest('base64');
  assert.equal(validTwilioSignature(url, body, signature, 'token'), true);
  assert.equal(validTwilioSignature(url, { ...body, Body: 'START' }, signature, 'token'), false);
  assert.equal(validateCoachingPreferences({ unknown: true }), null);
  assert.equal(validateCoachingPreferences({ toString: true }), null);
});

test('phone verification requires consent and approved code, throttles sends, removes phone and honors authenticated STOP', async () => {
  const f = await fixture(); try {
    let approved = false, sends = 0;
    const handler = createNotificationPhoneHandler({ getClient: () => f.admin, availability: () => ({ sms: true }),
      verify: async (path, fields) => { if (path === 'Verifications') sends++; return { ok: true, body: { status: approved ? 'approved' : 'pending', to: fields.To } }; } });
    const invoke = async body => { const res = response(); await handler({ method: 'POST', body, socket: { remoteAddress: '127.0.0.1' },
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', cookie: `athlete_id=${signAthleteSession(owner, 1)}` } }, res); return res; };
    const start = { action: 'start', phone: '+18015551234', consent: true };
    assert.equal((await invoke({ ...start, consent: false })).code, 400); assert.equal(sends, 0);
    assert.equal((await invoke(start)).code, 200);
    assert.equal((await invoke({ action: 'check', code: '123456' })).code, 400);
    approved = true; assert.equal((await invoke({ action: 'check', code: '123456' })).code, 200);
    let row = (await f.pg.query('select * from coaching_notification_settings where athlete_id=$1', [owner])).rows[0];
    assert.ok(row.phone_verified_at); assert.ok(row.sms_consent_at);
    await f.enable(owner); await f.upload();
    const env = { TWILIO_INBOUND_WEBHOOK_URL: 'https://threshold.example/api/coaching-notifications/sms-events', TWILIO_AUTH_TOKEN: 'token', TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_MESSAGING_SERVICE_SID: 'MGtest' };
    const body = { From: '+18015551234', Body: 'STOP', OptOutType: 'STOP', AccountSid: 'ACtest', MessagingServiceSid: 'MGtest' };
    const signature = createHmac('sha1', 'token').update(env.TWILIO_INBOUND_WEBHOOK_URL + Object.keys(body).sort().map(k => k + body[k]).join('')).digest('base64');
    const webhook = createSmsEventsHandler({ getClient: () => f.admin, env });
    let res = { ...response(), end() {}, send() {} };
    await webhook({ method: 'POST', body, headers: { 'x-twilio-signature': 'wrong' } }, res); assert.equal(res.code, 403);
    res = { ...response(), end() {}, send() {} };
    await webhook({ method: 'POST', body, headers: { 'x-twilio-signature': signature } }, res); assert.equal(res.code, 200);
    assert.equal((await f.claim('sms')).skipped, true);
    assert.equal((await invoke(start)).code, 200); assert.equal((await invoke(start)).code, 200); assert.equal((await invoke(start)).code, 429); assert.equal(sends, 3);
    assert.equal((await invoke({ action: 'remove' })).code, 200);
    row = (await f.pg.query('select * from coaching_notification_settings where athlete_id=$1', [owner])).rows[0];
    assert.equal(row.phone, null); assert.equal(row.phone_verified_at, null); assert.equal(row.sms_consent_at, null);
  } finally { await f.close(); }
});

test('expired relationships and removed timestamps suppress pending alerts even with active status', async () => {
  const f = await fixture(); try {
    await f.enable(owner); await f.upload();
    await f.pg.exec("update coach_athlete_relationships set expires_at=now()-interval '1 second'");
    assert.equal((await f.claim('email')).skipped, true);
    await f.upload(); assert.equal(await f.claim('email'), null);
    await f.pg.exec('update coach_athlete_relationships set expires_at=null,removed_at=now()');
    assert.equal((await f.claim('sms')).skipped, true);
  } finally { await f.close(); }
});

test('text alert opens the correct athlete and keeps private workout details out of the message', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const fields = new URLSearchParams(options.body);
      assert.ok(fields.get('Body').includes(`/coach/athletes/${athlete}`));
      assert.ok(fields.get('Body').includes('Reply STOP'));
      assert.equal(fields.get('Body').includes('private workout detail'), false);
      return { ok: true, json: async () => ({ sid: 'SMtest' }) };
    };
    assert.deepEqual(await deliverCoachingNotification({ channel: 'sms', mode: 'coach', athlete_id: athlete, phone: '+18015551234', event: 'workout_completed', body: 'private workout detail' }),
      { outcome: 'accepted', providerId: 'SMtest', stopped: false });
  } finally { globalThis.fetch = previous; }
});

test('disabled pre-migration settings load safely but authenticated writes and enabled reads fail', async () => {
  const f = await calendarFixture();
  try {
    const admin = client(f.pg);
    const invoke = async ({ enabled = false, channels = { email: false, sms: false }, method = 'GET', version = 1, actor = owner } = {}) => {
      const handler = createCoachingSettingsHandler({ getClient: () => admin, enabled: () => enabled, availability: () => channels });
      const res = response();
      await handler({ method, body: { preferences: { workout_completed_email: false } }, headers: {
        origin: 'http://localhost:3000', 'content-type': 'application/json', cookie: actor ? `athlete_id=${signAthleteSession(actor, version)}` : '',
      } }, res);
      return res;
    };
    const res = await invoke();
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.preferences, EMPTY_COACHING_PREFERENCES);
    assert.deepEqual(res.body.available, { email: false, sms: false });
    assert.equal(res.body.phone, null);
    assert.equal(res.body.phone_verified, false);
    assert.equal((await invoke({ method: 'PATCH' })).code, 503);
    assert.equal((await invoke({ enabled: true })).code, 503);
    assert.equal((await invoke({ channels: { email: true, sms: false } })).code, 503);
    assert.equal((await invoke({ actor: null })).code, 401);
    assert.equal((await invoke({ version: 2 })).code, 401);
  } finally { await f.close(); }
});

test('disabled fallback only handles missing tables and preserves migrated opt-out controls', async () => {
  const f = await fixture();
  try {
    await f.enable(owner);
    const invoke = async (admin, method = 'GET', body) => {
      const handler = createCoachingSettingsHandler({ getClient: () => admin, enabled: () => false, availability: () => ({ email: false, sms: false }) });
      const res = response();
      await handler({ method, body, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', cookie: `athlete_id=${signAthleteSession(owner, 1)}` } }, res);
      return res;
    };
    assert.equal((await invoke(f.admin)).body.preferences.workout_completed_email, true);
    const optedOut = await invoke(f.admin, 'PATCH', { preferences: { workout_completed_email: false } });
    assert.equal(optedOut.code, 200);
    assert.equal(optedOut.body.preferences.workout_completed_email, false);
    for (const [code, expected] of [['PGRST205', 200], ['42501', 503], ['42703', 503], ['PGRST204', 503], ['ETIMEDOUT', 503]]) {
      const admin = { ...f.admin, from: table => table !== 'coaching_notification_settings' ? f.admin.from(table) : {
        select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ error: { code } }),
      } };
      assert.equal((await invoke(admin)).code, expected, code);
    }
  } finally { await f.close(); }
});
