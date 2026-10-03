import axios from 'axios';

function apiUrl(path) {
  const override = process.env.STRAVA_QA_API_ORIGIN;
  if (!override) return `https://www.strava.com${path}`;
  const url = new URL(override);
  if (process.env.APP_ENV !== 'staging' || url.protocol !== 'http:'
    || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/') {
    throw new Error('Strava fixture origin must be isolated staging on loopback');
  }
  return `${url.origin}${path}`;
}

/**
 * Exchange an authorisation code for Strava tokens.
 *
 * @param {string} code - The authorisation code returned from Strava.
 * @param {string} clientId - Your Strava app client ID.
 * @param {string} clientSecret - Your Strava app client secret.
 * @param {string} redirectUri - Redirect URI registered with Strava.
 */
export async function exchangeToken(code, clientId, clientSecret, redirectUri) {
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  if (redirectUri) params.append('redirect_uri', redirectUri);
  const response = await axios.post(apiUrl('/api/v3/oauth/token'), params, { timeout: 15000 });
  return response.data;
}

/**
 * Refresh an expired Strava access token.
 *
 * @param {string} refreshToken - The refresh token from Strava.
 * @param {string} clientId
 * @param {string} clientSecret
 */
export async function refreshToken(refreshToken, clientId, clientSecret) {
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  const response = await axios.post(apiUrl('/api/v3/oauth/token'), params, { timeout: 15000 });
  return response.data;
}

/**
 * Fetch recent activities for the authenticated athlete.
 *
 * @param {string} accessToken - Valid access token.
 * @param {number} afterTimestamp - Unix timestamp (seconds) to filter activities after.
 */
export async function getRecentActivities(accessToken, afterTimestamp, { get = axios.get, maxPages = 10 } = {}) {
  const perPage = 200;
  const activities = [];
  let page = 1;
  const started = Date.now();

  while (page <= maxPages) {
    const remaining = 20000 - (Date.now() - started);
    if (remaining <= 0) throw new Error('Strava import time budget exhausted');
    const response = await get(apiUrl('/api/v3/athlete/activities'), {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { after: afterTimestamp, per_page: perPage, page },
      timeout: Math.min(15000, remaining),
    });

    if (!Array.isArray(response.data)) throw Object.assign(new Error('Invalid Strava activity response'), { code: 'invalid_provider_response' });
    const batch = response.data;
    activities.push(...batch);

    if (batch.length < perPage) {
      return activities;
    }

    page += 1;
  }

  // A full last page is not proof that history is complete. Never stamp a
  // silently truncated 2,000-activity backfill as complete.
  throw Object.assign(new Error('Strava history exceeds this import window'), { code: 'history_limit' });
}

export async function deauthorize(accessToken) {
  await axios.post(apiUrl('/oauth/deauthorize'), new URLSearchParams({ access_token: accessToken }), { timeout: 15000 });
}

export async function getDetailedActivity(accessToken, activityId) {
  const response = await axios.get(apiUrl(`/api/v3/activities/${activityId}`), {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { include_all_efforts: false },
    timeout: 15000,
  });
  return response.data;
}

export async function getActivityStreams(accessToken, activityId, keys) {
  const response = await axios.get(apiUrl(`/api/v3/activities/${activityId}/streams`), {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      keys: keys.join(','),
      key_by_type: true,
    },
    timeout: 15000,
  });
  return response.data;
}
