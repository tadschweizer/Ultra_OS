import test from 'node:test';
import assert from 'node:assert/strict';

import setInviteCookieHandler from '../pages/api/set-invite-cookie.js';
import stravaLoginHandler from '../pages/api/strava/login.js';
import { hasRole } from '../lib/auth/roleGuards.js';
import { protectedRoutes } from '../lib/siteNavigation.js';
import { getStravaRedirectUri } from '../lib/auth/oauth.js';

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

import { assertAuthPostMethod } from '../lib/auth/contracts.js';

test('athlete login contract rejects non-POST requests with actionable message', () => {
  const res = makeRes();
  const ok = assertAuthPostMethod({ method: 'GET' }, res);

  assert.equal(ok, false);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body?.error, 'Method not allowed');
});

test('coach role detection continues to work for coach login gating', () => {
  assert.equal(hasRole({ subscription_tier: 'coach' }, 'coach'), true);
  assert.equal(hasRole({ subscription_tier: 'free' }, 'coach'), false);
});

test('protected routes include critical post-login destinations', () => {
  for (const requiredRoute of ['/dashboard', '/connections', '/coach-command-center']) {
    assert.equal(
      protectedRoutes.includes(requiredRoute),
      true,
      `Missing protected route ${requiredRoute}; auth guard would be bypassed.`
    );
  }
});

test('invite acceptance entrypoint fails fast for malformed requests', async () => {
  const res = makeRes();
  await setInviteCookieHandler({ method: 'POST', body: {} }, res);

  assert.equal(res.statusCode, 400, 'Invite flow should fail fast when token is missing');
  assert.equal(res.body?.error, 'Token required');
});

test('strava login redirect uses callback URI and fails with clear error when not configured', () => {
  const originalClientId = process.env.STRAVA_CLIENT_ID;
  delete process.env.STRAVA_CLIENT_ID;

  const res = {
    headers: new Map(),
    statusCode: null,
    setHeader(k, v) { this.headers.set(k, v); },
    end() {},
  };

  stravaLoginHandler({ headers: { host: 'mythreshold.co', 'x-forwarded-proto': 'https' } }, res);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.get('Location'), '/login?error=strava_not_configured');

  if (originalClientId) process.env.STRAVA_CLIENT_ID = originalClientId;
});

test('strava redirect uri uses NEXT_PUBLIC_SITE_URL when STRAVA_REDIRECT_URI is unset', () => {
  const origStrava = process.env.STRAVA_REDIRECT_URI;
  const origSite = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.STRAVA_REDIRECT_URI;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://mythreshold.co';
  assert.equal(getStravaRedirectUri({}), 'https://mythreshold.co/api/strava/callback');
  if (origStrava) process.env.STRAVA_REDIRECT_URI = origStrava;
  if (origSite) process.env.NEXT_PUBLIC_SITE_URL = origSite;
  else delete process.env.NEXT_PUBLIC_SITE_URL;
});
