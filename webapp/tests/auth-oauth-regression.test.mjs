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

test('returns null when neither STRAVA_REDIRECT_URI nor NEXT_PUBLIC_SITE_URL is set', () => {
  const origStrava = process.env.STRAVA_REDIRECT_URI;
  const origSite = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.STRAVA_REDIRECT_URI;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const uri = getStravaRedirectUri({ headers: { host: 'localhost:3000', 'x-forwarded-proto': 'https' } });
  assert.equal(uri, null);
  if (origStrava) process.env.STRAVA_REDIRECT_URI = origStrava;
  if (origSite) process.env.NEXT_PUBLIC_SITE_URL = origSite;
});

test('builds strava callback from NEXT_PUBLIC_SITE_URL when STRAVA_REDIRECT_URI is unset', () => {
  const origStrava = process.env.STRAVA_REDIRECT_URI;
  const origSite = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.STRAVA_REDIRECT_URI;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://app.threshold.run';
  const uri = getStravaRedirectUri({});
  assert.equal(uri, 'https://app.threshold.run/api/strava/callback');
  if (origStrava) process.env.STRAVA_REDIRECT_URI = origStrava;
  if (origSite) process.env.NEXT_PUBLIC_SITE_URL = origSite;
  else delete process.env.NEXT_PUBLIC_SITE_URL;
});
