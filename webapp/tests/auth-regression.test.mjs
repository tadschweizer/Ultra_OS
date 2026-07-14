import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || 'test-session-secret';

import { assertAuthPostMethod, isValidAthleteId } from '../lib/auth/contracts.js';
import {
  clearAthleteCookie,
  getAthleteIdFromRequest,
  setAthleteCookie,
  signAthleteId,
  verifySignedAthleteId,
} from '../lib/auth/sessionCookies.js';
import {
  setViewAsCookie,
  signViewAsValue,
  verifyViewAsValue,
} from '../lib/auth/sessionCookies.js';
import { resolveEffectiveAthleteId } from '../lib/auth/requireAthlete.js';
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
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const res = makeRes();
  setAthleteCookie(res, uuid);
  const setCookie = String(res.getHeader('Set-Cookie'));
  // Value is the uuid plus a signature, and the cookie is httpOnly.
  assert.match(setCookie, /athlete_id=123e4567-e89b-12d3-a456-426614174000\./);
  assert.match(setCookie, /HttpOnly/);

  const signedValue = decodeURIComponent(setCookie.split(';')[0].split('=').slice(1).join('='));
  const req = { headers: { cookie: `athlete_id=${signedValue}` } };
  assert.equal(getAthleteIdFromRequest(req), uuid);

  clearAthleteCookie(res);
  const allCookies = res.getHeader('Set-Cookie');
  assert.equal(Array.isArray(allCookies), true);
  assert.match(String(allCookies[1]), /athlete_id=/);
});

test('session cookie signature is enforced', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';

  // A bare (legacy/forged) uuid with no signature is rejected.
  assert.equal(getAthleteIdFromRequest({ headers: { cookie: `athlete_id=${uuid}` } }), null);

  // A tampered signature is rejected.
  assert.equal(verifySignedAthleteId(`${uuid}.forged-signature-value-aaaaaaaaaaaaaaaaaaaaaaa`), null);

  // Swapping the uuid inside a validly signed value is rejected.
  const signed = signAthleteId(uuid);
  const otherUuid = '223e4567-e89b-12d3-a456-426614174000';
  const spliced = otherUuid + signed.slice(signed.lastIndexOf('.'));
  assert.equal(verifySignedAthleteId(spliced), null);

  // Garbage shapes are rejected without throwing.
  assert.equal(verifySignedAthleteId(null), null);
  assert.equal(verifySignedAthleteId(''), null);
  assert.equal(verifySignedAthleteId('not-a-cookie'), null);
  assert.equal(verifySignedAthleteId('.'), null);

  // The real signed value round-trips.
  assert.equal(verifySignedAthleteId(signed), uuid);
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

// ─── Admin read-only impersonation (view_as) ─────────────────────────────────

const ADMIN_UUID = '123e4567-e89b-12d3-a456-426614174000';
const TARGET_UUID = '223e4567-e89b-12d3-a456-426614174000';

function fakeAdminClient(isAdmin) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { is_admin: isAdmin }, error: null }),
        }),
      }),
    }),
  };
}

function requestAs(realId, { method = 'GET', viewAsValue = null } = {}) {
  const cookies = [`athlete_id=${signAthleteId(realId)}`];
  if (viewAsValue) cookies.push(`view_as=${viewAsValue}`);
  return { method, headers: { cookie: cookies.join('; ') } };
}

test('admin impersonation resolves the target id on GET only', async () => {
  const viewAs = signViewAsValue(TARGET_UUID);

  const get = await resolveEffectiveAthleteId(requestAs(ADMIN_UUID, { viewAsValue: viewAs }), fakeAdminClient(true));
  assert.deepEqual(get, { athleteId: TARGET_UUID, realAthleteId: ADMIN_UUID, isImpersonating: true });

  // Non-GET methods always resolve to the real athlete (middleware blocks
  // them outright as well) — a write must never touch either account wrongly.
  const post = await resolveEffectiveAthleteId(requestAs(ADMIN_UUID, { method: 'POST', viewAsValue: viewAs }), fakeAdminClient(true));
  assert.deepEqual(post, { athleteId: ADMIN_UUID, realAthleteId: ADMIN_UUID, isImpersonating: false });
});

test('a forged (unsigned) view_as cookie is treated as self', async () => {
  const resolved = await resolveEffectiveAthleteId(
    requestAs(ADMIN_UUID, { viewAsValue: `${TARGET_UUID}:9999999999999.fake-signature` }),
    fakeAdminClient(true)
  );
  assert.equal(resolved.athleteId, ADMIN_UUID);
  assert.equal(resolved.isImpersonating, false);
});

test('a validly signed view_as cookie is ignored for non-admins (demoted admin)', async () => {
  const viewAs = signViewAsValue(TARGET_UUID);
  const resolved = await resolveEffectiveAthleteId(requestAs(ADMIN_UUID, { viewAsValue: viewAs }), fakeAdminClient(false));
  assert.equal(resolved.athleteId, ADMIN_UUID);
  assert.equal(resolved.isImpersonating, false);
});

test('view_as values expire after their signed window', () => {
  const now = Date.now();
  const fresh = signViewAsValue(TARGET_UUID, now + 1000);
  assert.equal(verifyViewAsValue(fresh, now), TARGET_UUID);

  const expired = signViewAsValue(TARGET_UUID, now - 1);
  assert.equal(verifyViewAsValue(expired, now), null);

  // Two hours is the ceiling the cookie is minted with.
  const res = makeRes();
  setViewAsCookie(res, TARGET_UUID);
  assert.match(String(res.getHeader('Set-Cookie')), /Max-Age=7200/);
  assert.match(String(res.getHeader('Set-Cookie')), /HttpOnly/);
});

test('tampering with the view_as payload invalidates it', () => {
  const signed = signViewAsValue(TARGET_UUID);
  const swapped = ADMIN_UUID + signed.slice(TARGET_UUID.length);
  assert.equal(verifyViewAsValue(swapped), null);
  assert.equal(verifyViewAsValue(null), null);
  assert.equal(verifyViewAsValue('garbage'), null);
});

test('no API route reads the athlete_id cookie without signature verification', async () => {
  // Every route must go through lib/auth/sessionCookies (which verifies the
  // HMAC). Raw cookie parsing of athlete_id is only allowed in files that
  // authenticate some other way (webhooks) or manage other cookies.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  // fileURLToPath (not URL.pathname) so the scan also works on Windows.
  const apiDir = fileURLToPath(new URL('../pages/api', import.meta.url));

  const allowRawCookieParse = new Set([
    // These parse cookies for non-session values (webhook secrets, invite
    // tokens, pending billing state) — never to authenticate via athlete_id.
    'billing/webhook.js',
    'billing/checkout.js',
    'billing/portal.js',
    'billing/sync.js',
    'webhooks/coros/activities.js',
    'set-invite-cookie.js',
    'strava/callback.js',
  ]);

  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const rel = path.relative(apiDir, p);
      const src = fs.readFileSync(p, 'utf8');
      const parsesRawAthleteCookie = /cookie\.parse\([^)]*\)[\s\S]{0,120}?\.athlete_id|cookies\.athlete_id/.test(src);
      if (parsesRawAthleteCookie && !allowRawCookieParse.has(rel)) {
        offenders.push(rel);
      }
    }
  };
  walk(apiDir);
  assert.deepEqual(offenders, [], `Routes reading athlete_id cookie without verification: ${offenders.join(', ')}`);
});
