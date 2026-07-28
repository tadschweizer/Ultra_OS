import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || 'test-session-secret';

import { assertAuthPostMethod, isValidAthleteId } from '../lib/auth/contracts.js';
import {
  clearAthleteCookie,
  getAthleteIdFromRequest,
  getSessionFromRequest,
  renewAthleteCookieIfStale,
  setAthleteCookie,
  signAthleteSession,
  verifyAthleteSession,
  SESSION_MAX_AGE_SEC,
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
  // Value is `<uuid>:<version>:<expiry>` plus a signature, and it is httpOnly.
  assert.match(setCookie, /athlete_id=123e4567-e89b-12d3-a456-426614174000%3A1%3A\d+\./);
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

  // A bare (forged) uuid with no signature is rejected.
  assert.equal(getAthleteIdFromRequest({ headers: { cookie: `athlete_id=${uuid}` } }), null);

  // The pre-expiry format `<uuid>.<mac>` is no longer accepted: those tokens
  // could never expire or be revoked, so honouring them would reopen the hole
  // this format exists to close.
  const legacy = `${uuid}.${'a'.repeat(43)}`;
  assert.equal(verifyAthleteSession(legacy), null);

  // A tampered signature is rejected.
  const signed = signAthleteSession(uuid, 1);
  assert.equal(verifyAthleteSession(`${signed.slice(0, signed.lastIndexOf('.'))}.forged`), null);

  // Swapping the uuid inside a validly signed value is rejected.
  const otherUuid = '223e4567-e89b-12d3-a456-426614174000';
  const spliced = signed.replace(uuid, otherUuid);
  assert.equal(verifyAthleteSession(spliced), null);

  // Bumping the version inside a signed value is rejected.
  assert.equal(verifyAthleteSession(signed.replace(`${uuid}:1:`, `${uuid}:2:`)), null);

  // Garbage shapes are rejected without throwing.
  for (const bad of [null, '', 'not-a-cookie', '.', `${uuid}::.x`]) {
    assert.equal(verifyAthleteSession(bad), null);
  }

  // The real signed value round-trips with its version.
  const parsed = verifyAthleteSession(signed);
  assert.equal(parsed.athleteId, uuid);
  assert.equal(parsed.sessionVersion, 1);
});

test('session tokens expire server-side', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const now = Date.now();

  const fresh = signAthleteSession(uuid, 1, now + 1000);
  assert.equal(verifyAthleteSession(fresh, now).athleteId, uuid);

  // A captured cookie stops working on schedule even if the browser would
  // still send it — the old format had no expiry the server could enforce.
  const expired = signAthleteSession(uuid, 1, now - 1);
  assert.equal(verifyAthleteSession(expired, now), null);
});

test('session version is carried so revocation can be detected', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const res = makeRes();
  setAthleteCookie(res, uuid, 7);

  const value = decodeURIComponent(String(res.getHeader('Set-Cookie')).split(';')[0].split('=').slice(1).join('='));
  const session = getSessionFromRequest({ headers: { cookie: `athlete_id=${value}` } });
  assert.equal(session.sessionVersion, 7);
});

test('an active session slides forward but a fresh one is left alone', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const now = Date.now();

  // Issued moments ago: no Set-Cookie, so most responses stay header-free.
  const fresh = makeRes();
  const justIssued = { athleteId: uuid, sessionVersion: 1, expiresAtMs: now + SESSION_MAX_AGE_SEC * 1000 };
  assert.equal(renewAthleteCookieIfStale(fresh, justIssued, now), false);
  assert.equal(fresh.getHeader('Set-Cookie'), undefined);

  // Issued two days ago: renewed, so an active user is never logged out.
  const stale = makeRes();
  const twoDaysOld = {
    athleteId: uuid,
    sessionVersion: 1,
    expiresAtMs: now + SESSION_MAX_AGE_SEC * 1000 - 2 * 24 * 60 * 60 * 1000,
  };
  assert.equal(renewAthleteCookieIfStale(stale, twoDaysOld, now), true);
  assert.match(String(stale.getHeader('Set-Cookie')), /athlete_id=/);
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

function fakeAdminClient(isAdmin, sessionVersion = 1) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { is_admin: isAdmin, session_version: sessionVersion },
            error: null,
          }),
        }),
      }),
    }),
  };
}

function requestAs(realId, { method = 'GET', viewAsValue = null, sessionVersion = 1 } = {}) {
  const cookies = [`athlete_id=${signAthleteSession(realId, sessionVersion)}`];
  if (viewAsValue) cookies.push(`view_as=${viewAsValue}`);
  return { method, headers: { cookie: cookies.join('; ') } };
}

test('admin impersonation resolves the target id on GET only', async () => {
  const viewAs = signViewAsValue(TARGET_UUID);

  const get = await resolveEffectiveAthleteId(requestAs(ADMIN_UUID, { viewAsValue: viewAs }), fakeAdminClient(true));
  assert.equal(get.athleteId, TARGET_UUID);
  assert.equal(get.realAthleteId, ADMIN_UUID);
  assert.equal(get.isImpersonating, true);

  // Non-GET methods always resolve to the real athlete (middleware blocks
  // them outright as well) — a write must never touch either account wrongly.
  const post = await resolveEffectiveAthleteId(requestAs(ADMIN_UUID, { method: 'POST', viewAsValue: viewAs }), fakeAdminClient(true));
  assert.equal(post.athleteId, ADMIN_UUID);
  assert.equal(post.isImpersonating, false);
});

test('a session whose version no longer matches the athlete row is rejected', async () => {
  // What "sign out everywhere" and a password reset rely on: the cookie was
  // signed at version 1, the row has moved to 2, so the session is dead.
  const revoked = await resolveEffectiveAthleteId(
    requestAs(ADMIN_UUID, { sessionVersion: 1 }),
    fakeAdminClient(true, 2)
  );
  assert.equal(revoked.athleteId, null);

  const live = await resolveEffectiveAthleteId(
    requestAs(ADMIN_UUID, { sessionVersion: 2 }),
    fakeAdminClient(true, 2)
  );
  assert.equal(live.athleteId, ADMIN_UUID);
});

test('resolveEffectiveAthleteId fails closed when the athlete row cannot be read', async () => {
  const brokenClient = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error('db down') }) }),
      }),
    }),
  };
  const resolved = await resolveEffectiveAthleteId(requestAs(ADMIN_UUID), brokenClient);
  assert.equal(resolved.athleteId, null);
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
