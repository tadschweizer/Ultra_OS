import { getStravaRedirectUri } from '../../../lib/auth/oauth.js';
import { createOAuthState, setOAuthReturnPath } from '../../../lib/auth/oauthState.js';
import {
  normalizeSignupRoleIntent,
  setSignupRoleIntent,
} from '../../../lib/auth/signupRoleIntent.js';

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
  if (typeof req.query?.next === 'string') setOAuthReturnPath(res, 'strava', req.query.next);
  if (req.query?.role !== undefined) {
    const signupRole = normalizeSignupRoleIntent(req.query.role, req.query.next);
    if (!signupRole) {
      res.status(400).json({ error: 'role must be coach, athlete-with-coach, or individual.' });
      return;
    }
    setSignupRoleIntent(res, signupRole);
  }

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
