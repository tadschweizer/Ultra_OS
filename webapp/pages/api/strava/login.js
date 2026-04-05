export const runtime = 'edge';

/**
 * API route to initiate the Strava OAuth flow.
 *
 * Redirects the user to Strava's authorisation endpoint with the
 * scopes needed to read activities and refresh tokens.
 */
export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  const scope = 'read,activity:read_all,profile:read_all';
  const authUrl =
    'https://www.strava.com/oauth/authorize?client_id=' +
    clientId +
    '&response_type=code&redirect_uri=' +
    encodeURIComponent(redirectUri) +
    '&approval_prompt=auto&scope=' +
    encodeURIComponent(scope);
  res.setHeader('Location', authUrl);
  res.statusCode = 302;
  res.end();
}
