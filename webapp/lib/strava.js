import axios from 'axios';

export function getStravaRedirectUri(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host;

  if (host) {
    const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
    return `${protocol}://${host}/api/strava/callback`;
  }

  return process.env.STRAVA_REDIRECT_URI || null;
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
  const response = await axios.post('https://www.strava.com/api/v3/oauth/token', params);
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
  const response = await axios.post('https://www.strava.com/api/v3/oauth/token', params);
  return response.data;
}

/**
 * Fetch recent activities for the authenticated athlete.
 *
 * @param {string} accessToken - Valid access token.
 * @param {number} afterTimestamp - Unix timestamp (seconds) to filter activities after.
 */
export async function getRecentActivities(accessToken, afterTimestamp) {
  const perPage = 200;
  const activities = [];
  let page = 1;

  while (page <= 10) {
    const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { after: afterTimestamp, per_page: perPage, page },
    });

    const batch = response.data || [];
    activities.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return activities;
}

export async function getDetailedActivity(accessToken, activityId) {
  const response = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { include_all_efforts: false },
  });
  return response.data;
}

export async function getActivityStreams(accessToken, activityId, keys) {
  const response = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}/streams`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      keys: keys.join(','),
      key_by_type: true,
    },
  });
  return response.data;
}
