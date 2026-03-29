import { createClient } from '@supabase/supabase-js';
import { exchangeToken } from '../../../lib/strava';
import { supabase } from '../../../lib/supabaseClient';
import cookie from 'cookie';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/**
 * Handle the Strava OAuth callback.
 *
 * Exchanges the provided code for an access token and refresh token,
 * upserts the athlete record in Supabase, sets a cookie with the athlete
 * ID, and then redirects the browser to the dashboard page.
 */
export default async function handler(req, res) {
  const { code } = req.query;
  const cookies = cookie.parse(req.headers.cookie || '');
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
      .select('id, onboarding_complete, name')
      .single();
    if (athleteError) {
      throw athleteError;
    }
    const athleteId = savedAthlete.id;

    // If there's a pending invite token cookie, mark it used now
    const inviteToken = cookies.pending_invite_token;
    if (inviteToken) {
      const adminClient = getAdminClient();
      if (adminClient) {
        await adminClient
          .from('invites')
          .update({ used_at: new Date().toISOString(), used_by: athleteId })
          .eq('token', inviteToken)
          .is('used_at', null);
      }
    }

    const cookieOptions = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };

    // Set athlete_id cookie + clear the pending invite token cookie
    const setCookies = [
      cookie.serialize('athlete_id', athleteId, {
        ...cookieOptions,
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      }),
      cookie.serialize('pending_invite_token', '', {
        ...cookieOptions,
        httpOnly: true,
        maxAge: 0, // clear it
      }),
    ];
    res.setHeader('Set-Cookie', setCookies);

    const destination = savedAthlete.onboarding_complete
      ? '/dashboard'
      : `/onboarding?strava=connected&name=${encodeURIComponent(savedAthlete.name || athleteName || 'Strava athlete')}`;
    res.setHeader('Location', destination);
    res.statusCode = 302;
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to process Strava callback');
  }
}
