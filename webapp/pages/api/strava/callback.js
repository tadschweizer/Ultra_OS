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
    const tokenData = await exchangeToken(code, clientId, clientSecret, redirectUri);
    const { access_token, refresh_token, expires_at, athlete } = tokenData;
    // Upsert athlete record by Strava ID
    const { data: existingAthlete } = await supabase
      .from('athletes')
      .select('*')
      .eq('strava_id', athlete.id.toString())
      .maybeSingle();
    let athleteId;
    if (existingAthlete) {
      await supabase
        .from('athletes')
        .update({
          name: athlete.firstname + ' ' + athlete.lastname,
          email: athlete.email || null,
          access_token,
          refresh_token,
          token_expires_at: new Date(expires_at * 1000).toISOString(),
        })
        .eq('id', existingAthlete.id);
      athleteId = existingAthlete.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('athletes')
        .insert({
          name: athlete.firstname + ' ' + athlete.lastname,
          email: athlete.email || null,
          strava_id: athlete.id.toString(),
          access_token,
          refresh_token,
          token_expires_at: new Date(expires_at * 1000).toISOString(),
        })
        .select()
        .single();
      if (insertError) throw insertError;
      athleteId = inserted.id;
    }
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
