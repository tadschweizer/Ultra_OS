import { exchangeToken } from '../../../lib/strava';
import { supabase } from '../../../lib/supabaseClient';
import cookie from 'cookie';

/**
 * Handle the Strava OAuth callback.
 *
 * Exchanges the provided code for an access token and refresh token,
 * upserts the athlete record in Supabase, sets a cookie with the athlete
 * ID, and then redirects the browser to the dashboard page.
 */
export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) {
    res.status(400).send('Missing authorisation code');
    return;
  }
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const redirectUri = process.env.STRAVA_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Missing Strava environment variables: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REDIRECT_URI are required.'
      );
    }
    const tokenData = await exchangeToken(code, clientId, clientSecret, redirectUri);
    const { access_token, refresh_token, expires_at, athlete } = tokenData;
    const athleteName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ').trim();
    const { data: savedAthlete, error: athleteError } = await supabase
      .from('athletes')
      .upsert(
        {
          name: athleteName || null,
          email: athlete.email || null,
          strava_id: athlete.id.toString(),
          access_token,
          refresh_token,
          token_expires_at: new Date(expires_at * 1000).toISOString(),
        },
        { onConflict: 'strava_id' }
      )
      .select('id')
      .single();
    if (athleteError) {
      throw athleteError;
    }
    const athleteId = savedAthlete.id;
    // Set a non‑httpOnly cookie to remember the athlete ID on the client.
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('athlete_id', athleteId, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    );
    res.setHeader('Location', '/dashboard');
    res.statusCode = 302;
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to process Strava callback');
  }
}
