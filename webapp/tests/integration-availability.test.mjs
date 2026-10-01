import test from 'node:test';
import assert from 'node:assert/strict';
import { integrationAvailability } from '../lib/integrationAvailability.js';
import handler from '../pages/api/integrations/status.js';
import { handleConnectorLogin, handleConnectorCallback } from '../lib/connectorOAuth.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';

test('Strava requires both credentials and a callback location; secrets are not in the result', () => {
  assert.deepEqual(integrationAvailability({}), { strava: false });
  assert.deepEqual(integrationAvailability({ STRAVA_CLIENT_ID: 'id', NEXT_PUBLIC_SITE_URL: 'https://example.test' }), { strava: false });
  assert.deepEqual(integrationAvailability({ STRAVA_CLIENT_ID: 'id', STRAVA_CLIENT_SECRET: 'secret', STRAVA_REDIRECT_URI: 'https://example.test/callback' }), { strava: true });
});

test('public integration status is read only and never cached', () => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.code = s; return this; }, json(p) { this.body = p; } };
  handler({ method: 'GET' }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(Object.keys(res.body), ['strava']);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  handler({ method: 'POST' }, res);
  assert.equal(res.code, 405);
});

test('unfinished wearable logins never redirect authenticated users to provider OAuth', () => {
  process.env.SESSION_COOKIE_SECRET = 'isolated-integration-test-secret-with-more-than-32-characters';
  const req = { headers: { cookie: `athlete_id=${signAthleteSession('11111111-1111-4111-8111-111111111111')}` } };
  for (const provider of ['garmin', 'coros', 'oura', 'ultrahuman']) {
    const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; } };
    handleConnectorLogin(provider, req, res);
    assert.equal(res.code, 501);
    assert.equal(res.headers.Location, undefined);
    assert.deepEqual(Object.keys(res.body), ['error']);
    assert.doesNotMatch(JSON.stringify(res.body), /CLIENT_|REDIRECT_|missing_env/);
  }
});

test('unconfigured callbacks give an actionable error without configuration names', async () => {
  const req = { headers: { cookie: `athlete_id=${signAthleteSession('11111111-1111-4111-8111-111111111111')}` }, query: {} };
  const res = { status(c) { this.code = c; return this; }, json(b) { this.body = b; } };
  await handleConnectorCallback('unknown-provider', req, res);
  assert.equal(res.code, 503);
  assert.deepEqual(Object.keys(res.body), ['error']);
  assert.doesNotMatch(JSON.stringify(res.body), /CLIENT_|REDIRECT_|missing_env/);
});
