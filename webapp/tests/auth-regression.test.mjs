import test from 'node:test';
import assert from 'node:assert/strict';

import { assertAuthPostMethod, isValidAthleteId } from '../lib/auth/contracts.js';
import { clearAthleteCookie, getAthleteIdFromRequest, setAthleteCookie } from '../lib/auth/sessionCookies.js';
import { hasRole, requireRole } from '../lib/auth/roleGuards.js';
import logoutHandler from '../pages/api/auth/logout.js';

function makeRes() {
  const headers = new Map();
  return {
    statusCode: null,
    body: null,
    getHeader: (k) => headers.get(k),
    setHeader: (k, v) => headers.set(k, v),
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('athlete id validation only allows UUID', () => {
  assert.equal(isValidAthleteId('bad-id'), false);
  assert.equal(isValidAthleteId('123e4567-e89b-12d3-a456-426614174000'), true);
});

test('set/clear cookie and parse athlete id', () => {
  const res = makeRes();
  setAthleteCookie(res, '123e4567-e89b-12d3-a456-426614174000');
  const setCookie = String(res.getHeader('Set-Cookie'));
  assert.match(setCookie, /athlete_id=123e4567-e89b-12d3-a456-426614174000/);

  const req = { headers: { cookie: 'athlete_id=123e4567-e89b-12d3-a456-426614174000' } };
  assert.equal(getAthleteIdFromRequest(req), '123e4567-e89b-12d3-a456-426614174000');

  clearAthleteCookie(res);
  const allCookies = res.getHeader('Set-Cookie');
  assert.equal(Array.isArray(allCookies), true);
  assert.match(String(allCookies[1]), /athlete_id=/);
});

test('role guards protect coach/admin routes', () => {
  assert.equal(hasRole({ subscription_tier: 'coach' }, 'coach'), true);
  assert.equal(requireRole({ is_admin: false }, 'admin').allowed, false);
});

test('non-post auth requests are rejected', () => {
  const res = makeRes();
  const ok = assertAuthPostMethod({ method: 'GET' }, res);
  assert.equal(ok, false);
  assert.equal(res.statusCode, 405);
});

test('logout clears cookie and returns ok', async () => {
  const res = makeRes();
  await logoutHandler({ method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.match(String(res.getHeader('Set-Cookie')), /athlete_id=/);
});
