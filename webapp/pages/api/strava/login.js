import { getStravaRedirectUri } from '../../../lib/auth/oauth.js';
import { createOAuthState } from '../../../lib/auth/oauthState.js';

/**
 * API route to initiate the Strava OAuth flow.
 *
 * Redirects the user to Strava's authorisation endpoint with the
 * scopes needed to read activities and refresh tokens.
 */
export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = getStravaRedirectUri(req);
  if (!clientId || !redirectUri) {
    res.setHeader('Location', '/login?error=strava_not_configured');
    res.statusCode = 302;
    res.end();
    return;
  }

  // Binds this authorization to this browser; the callback rejects any code
  // that comes back without the matching nonce. See lib/auth/oauthState.js.
  const state = createOAuthState(res, 'strava');

  const scope = 'read,activity:read_all,profile:read_all';
  const authUrl =
    'https://www.strava.com/oauth/authorize?client_id=' +
    clientId +
    '&response_type=code&redirect_uri=' +
    encodeURIComponent(redirectUri) +
    '&approval_prompt=auto&scope=' +
    encodeURIComponent(scope) +
    '&state=' +
    encodeURIComponent(state);
  res.setHeader('Location', authUrl);
  res.statusCode = 302;
  res.end();
}
