import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccessTokenFromCallbackUrl, getStravaRedirectUri } from '../lib/auth/oauth.js';

test('extracts access token from hash callback', () => {
  const parsed = getAccessTokenFromCallbackUrl('https://app.threshold.run/auth/callback#access_token=a1&refresh_token=r1');
  assert.equal(parsed.accessToken, 'a1');
  assert.equal(parsed.refreshToken, 'r1');
});

test('does not parse hash token when code flow is present', () => {
  const parsed = getAccessTokenFromCallbackUrl('https://app.threshold.run/auth/callback?code=abc#access_token=a1');
  assert.equal(parsed, null);
});

test('builds strava callback from host when explicit redirect is unset', () => {
  const original = process.env.STRAVA_REDIRECT_URI;
  delete process.env.STRAVA_REDIRECT_URI;
  const uri = getStravaRedirectUri({ headers: { host: 'localhost:3000', 'x-forwarded-proto': 'https' } });
  assert.equal(uri, 'https://localhost:3000/api/strava/callback');
  if (original) process.env.STRAVA_REDIRECT_URI = original;
});
