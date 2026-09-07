import test from 'node:test';
import assert from 'node:assert/strict';
import { coachEntitlement, hasActivePilot, isActiveCoachingRelationship } from '../lib/pilotEntitlements.js';
import { loadCheckInEntitlement, EntitlementLookupError } from '../lib/pilotEntitlementsServer.js';
import { canLogCheckIn, canLogIntervention, canAccessFullInsights, buildUsageSnapshot } from '../lib/subscriptionTiers.js';
import { createLogInterventionHandler } from '../pages/api/log-intervention.js';
import { createPilotAccessHandler } from '../pages/api/admin/pilot-access.js';
import { createResearchAdminHandler } from '../pages/api/research-library/admin.js';
import { buildAccountAccess } from '../lib/auth/roleGuards.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { pilotDb, athleteId, coachOwnerId, coachId, adminId, fixedNow } from './helpers/pilotDb.mjs';

process.env.SESSION_COOKIE_SECRET = 'pilot-regression-secret-with-more-than-32-characters';
process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.example.test';
function request(id = athleteId, body = {}, method = 'POST') {
  return { method, query: { coach_id: coachId }, headers: { cookie: id ? `athlete_id=${signAthleteSession(id)}` : '',
    origin: 'https://staging.example.test', 'content-type': 'application/json' }, body };
}
function response() {
  return { code: null, body: null, headers: {}, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, end() { return this; }, setHeader(k, v) { this.headers[k] = v; } };
}
const matrix = [
  ['free athlete', { pilot: false, relationship: null }, false],
  ['pilot linked', {}, true],
  ['paid coach linked', { pilot: false, coachTier: 'coach' }, true],
  ['pending', { relationship: 'pending' }, false],
  ['paused', { relationship: 'paused' }, false],
  ['removed', { relationship: 'removed' }, false],
  ['expired status', { relationship: 'expired' }, false],
  ['free coach linked', { pilot: false }, false],
  ['independently paid', { tier: 'individual', pilot: false, relationship: null }, true],
  ['research linked', { tier: 'research' }, true],
];
for (const [name, options, unlimited] of matrix) {
  test(`entitlement matrix: ${name}`, async () => {
    const db = pilotDb(options);
    const athlete = db.tables.athletes[0];
    const access = await loadCheckInEntitlement(db, athlete, fixedNow);
    assert.equal(access.unlimited, unlimited);
    assert.equal(canLogCheckIn(athlete, 6, access).allowed, unlimited);
    const usage = buildUsageSnapshot({ athlete, weeklyCheckIns: 6, checkInEntitlement: access });
    assert.equal(usage.checkInsUnlimited, unlimited);
    if (unlimited) assert.equal(usage.atCheckInLimit, false);
    if (athlete.subscription_tier === 'free') {
      assert.equal(canLogIntervention(athlete, 15).allowed, false);
      assert.equal(canAccessFullInsights(athlete).allowed, false);
    }
  });
}
test('revoked, future and expired pilot grants fail; relationship removal and expiry fail', async () => {
  for (const patch of [{ revoked_at: fixedNow.toISOString() }, { expires_at: fixedNow.toISOString() }, { starts_at: '2027-01-01' }]) {
    const db = pilotDb(); Object.assign(db.tables.coach_pilot_entitlements[0], patch);
    assert.equal((await loadCheckInEntitlement(db, db.tables.athletes[0], fixedNow)).unlimited, false);
  }
  for (const patch of [{ removed_at: fixedNow.toISOString() }, { expires_at: fixedNow.toISOString() }, { expires_at: 'invalid' }]) {
    const db = pilotDb(); Object.assign(db.tables.coach_athlete_relationships[0], patch);
    assert.equal((await loadCheckInEntitlement(db, db.tables.athletes[0], fixedNow)).unlimited, false);
  }
  assert.equal(hasActivePilot(null, fixedNow), false);
  assert.equal(isActiveCoachingRelationship({ status: 'pending' }, fixedNow), false);
});
test('Stripe-owned canceled coach and athlete lose paid entitlement; grace status remains', async () => {
  const db = pilotDb({ pilot: false, coachTier: 'coach' });
  Object.assign(db.tables.athletes[1], { stripe_subscription_id: 'sub_coach', stripe_subscription_status: 'canceled' });
  assert.equal((await loadCheckInEntitlement(db, db.tables.athletes[0], fixedNow)).unlimited, false);
  db.tables.athletes[1].stripe_subscription_status = 'past_due';
  assert.equal((await loadCheckInEntitlement(db, db.tables.athletes[0], fixedNow)).unlimited, true);
  db.tables.coach_athlete_relationships = [];
  Object.assign(db.tables.athletes[0], { subscription_tier: 'individual', stripe_subscription_id: 'sub_athlete', stripe_subscription_status: 'canceled' });
  const entitlement = await loadCheckInEntitlement(db, db.tables.athletes[0], fixedNow);
  assert.equal(entitlement.unlimited, false);
  assert.equal(canLogCheckIn(db.tables.athletes[0], 3, entitlement).allowed, false);
});
test('each entitlement lookup failure is explicit; independent paid access needs no coach lookup', async () => {
  for (const table of ['coach_athlete_relationships', 'coach_profiles', 'athletes', 'coach_pilot_entitlements']) {
    const db = pilotDb(); db.failures.add(table);
    await assert.rejects(loadCheckInEntitlement(db, db.tables.athletes[0], fixedNow), EntitlementLookupError);
  }
  const db = pilotDb({ tier: 'individual' }); db.failures.add('coach_pilot_entitlements');
  assert.equal((await loadCheckInEntitlement(db, db.tables.athletes[0], fixedNow)).unlimited, true);
  assert.equal(db.calls.length, 0);
});
test('seven consecutive controlled dates save through real handler; revocation restores cap and preserves history', async () => {
  const db = pilotDb();
  const handler = createLogInterventionHandler({ getClient: () => db, now: () => db.now });
  for (let day = 0; day < 7; day++) {
    db.now = new Date(fixedNow.getTime() + day * 86400000);
    const res = response();
    await handler(request(athleteId, { intervention_type: 'Workout Check-in', date: db.now.toISOString().slice(0, 10),
      protocol_payload: { legs_feel: 7, energy_feel: 6, perceived_effort: 5 } }), res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
  }
  assert.equal(new Set(db.tables.interventions.map(row => row.date)).size, 7);
  assert.ok(db.tables.interventions.every(row => row.athlete_id === athleteId));
  db.tables.coach_pilot_entitlements[0].revoked_at = db.now.toISOString();
  const denied = response();
  await handler(request(athleteId, { intervention_type: 'Workout Check-in', pilot: true, subscription_tier: 'coach', athlete_id: coachOwnerId }), denied);
  assert.equal(denied.code, 403);
  assert.equal(db.tables.interventions.length, 7);
  db.tables.athletes[0].subscription_tier = 'individual';
  const paid = response(); await handler(request(athleteId, { intervention_type: 'Workout Check-in' }), paid);
  assert.equal(paid.code, 200);
});
test('free athlete can submit three, fourth blocked; pilot claims cannot unlock other interventions', async () => {
  const db = pilotDb({ pilot: false });
  const handler = createLogInterventionHandler({ getClient: () => db, now: () => fixedNow });
  for (let i = 0; i < 4; i++) {
    const res = response(); await handler(request(athleteId, { intervention_type: 'Workout Check-in', pilot: true }), res);
    assert.equal(res.code, i < 3 ? 200 : 403);
  }
  while (db.tables.interventions.length < 15) db.tables.interventions.push({ athlete_id: athleteId });
  const res = response(); await handler(request(athleteId, { intervention_type: 'Sauna - Recovery', pilot: true }), res);
  assert.equal(res.code, 403);
});
test('check-in rate limit and dependency failure apply to paid athletes without writes', async () => {
  for (const failure of ['limited', 'lookup']) {
    const db = pilotDb({ tier: 'individual' });
    if (failure === 'limited') db.rateAllowed = false; else db.failures.add('consume_checkin_rate_limit');
    const res = response(); await createLogInterventionHandler({ getClient: () => db })(request(athleteId, { intervention_type: 'Workout Check-in' }), res);
    assert.equal(res.code, failure === 'limited' ? 429 : 503);
    assert.equal(db.tables.interventions.length, 0);
  }
});
test('entitlement errors stop check-in writes and forged/revoked sessions are rejected', async () => {
  const db = pilotDb(); db.failures.add('coach_pilot_entitlements');
  const handler = createLogInterventionHandler({ getClient: () => db });
  const res = response(); await handler(request(athleteId, { intervention_type: 'Workout Check-in' }), res);
  assert.equal(res.code, 503); assert.equal(db.tables.interventions.length, 0);
  for (const req of [request(null), { ...request(), headers: { cookie: `athlete_id=${athleteId}` } }]) {
    const denied = response(); await handler(req, denied); assert.equal(denied.code, 401);
  }
  db.tables.athletes[0].session_version = 2;
  const denied = response(); await handler(request(), denied); assert.equal(denied.code, 401);
});
test('role and profile alone cannot activate pilot, paid, or administrator access', () => {
  const db = pilotDb({ pilot: false });
  const athlete = db.tables.athletes[1], profile = db.tables.coach_profiles[0];
  const access = coachEntitlement({ athlete, profile, now: fixedNow });
  assert.deepEqual(access, { eligible: false, pilot: false, paid: false, source: null });
  assert.equal(buildAccountAccess({ athlete, coachProfile: profile }).capabilities.administrator, false);
});
for (const method of ['GET', 'POST']) {
  for (const id of [null, athleteId, coachOwnerId]) {
    test(`pilot administration ${method}: non-admin ${id} cannot read or provision grants`, async () => {
      const db = pilotDb(); const res = response();
      await createPilotAccessHandler({ getClient: () => db })(request(id, { coach_id: coachId, action: 'grant', reason: 'forged', expires_at: '2027-01-01' }, method), res);
      assert.equal(res.code, id ? 403 : 401);
      assert.equal(db.calls.some(call => call.table === 'coach_pilot_entitlements'), false);
    });
  }
}
test('administrator grant, repeat, read, revoke, repeat revoke and renew keep one record and preserve role/billing', async () => {
  const db = pilotDb({ pilot: false }); const before = structuredClone(db.tables.athletes);
  const handler = createPilotAccessHandler({ getClient: () => db, now: () => fixedNow });
  for (const action of ['grant', 'grant', 'revoke', 'revoke', 'grant']) {
    const res = response(); await handler(request(adminId, { coach_id: coachId, action, reason: 'Approved pilot', expires_at: '2026-10-01' }), res);
    assert.equal(res.code, 200); assert.equal(db.tables.coach_pilot_entitlements.length, 1);
    assert.equal(hasActivePilot(res.body.grant, fixedNow), action === 'grant');
    assert.equal(res.body.grant.updated_by, adminId);
  }
  const res = response(); await handler(request(adminId, {}, 'GET'), res);
  assert.equal(res.code, 200); assert.equal(res.body.profile.id, coachId);
  assert.deepEqual(db.tables.athletes, before);
});
test('pilot provisioning rejects cross-origin, invalid expiry, wrong method and revoked administrator session', async () => {
  const db = pilotDb(); const handler = createPilotAccessHandler({ getClient: () => db, now: () => fixedNow });
  const body = { coach_id: coachId, action: 'grant', reason: 'Pilot', expires_at: '2026-10-01' };
  const cross = request(adminId, body); cross.headers.origin = 'https://attacker.test';
  for (const [req, code] of [[cross, 403], [request(adminId, { ...body, expires_at: '2020-01-01' }), 400], [request(adminId, body, 'PUT'), 405]]) {
    const res = response(); await handler(req, res); assert.equal(res.code, code);
  }
  db.tables.athletes[2].session_version = 2;
  const res = response(); await handler(request(adminId, body), res); assert.equal(res.code, 401);
  assert.equal(db.calls.some(call => call.table === 'coach_pilot_entitlements' && call.operation !== 'select'), false);
});
for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
  test(`pilot coach cannot use research administration ${method}`, async () => {
    const db = pilotDb(); const res = response();
    await createResearchAdminHandler({ getClient: () => db })(request(coachOwnerId, { is_admin: true }, method), res);
    assert.equal(res.code, 403);
    assert.equal(db.calls.some(call => call.table === 'research_library_entries'), false);
  });
}
