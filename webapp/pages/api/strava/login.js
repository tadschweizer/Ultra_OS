import cookie from 'cookie';
import { getStravaRedirectUri } from '../../../lib/strava';

/**
 * API route to initiate the Strava OAuth flow.
 *
 * Redirects the user to Strava's authorisation endpoint with the
 * scopes needed to read activities and refresh tokens.
 */
export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = getStravaRedirectUri(req);
  const isLinkMode = req.query?.link === '1';

  if (!clientId || !redirectUri) {
    res.status(500).json({ error: 'Strava login is not configured correctly.' });
    return;
  }

  const scope = 'read,activity:read_all,profile:read_all';
  const authUrl =
    'https://www.strava.com/oauth/authorize?client_id=' +
    clientId +
    '&response_type=code&redirect_uri=' +
    encodeURIComponent(redirectUri) +
    '&approval_prompt=auto&scope=' +
    encodeURIComponent(scope);

  res.setHeader(
    'Set-Cookie',
    cookie.serialize('pending_account_link', isLinkMode ? '1' : '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: isLinkMode ? 60 * 10 : 0,
    })
  );
  res.setHeader('Location', authUrl);
  res.statusCode = 302;
  res.end();
}
