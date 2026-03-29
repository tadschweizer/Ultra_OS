import { supabase } from '../../lib/supabaseClient';
import { refreshToken, getRecentActivities } from '../../lib/strava';
import cookie from 'cookie';

/**
 * API route to fetch recent Strava activities for the authenticated athlete.
 *
 * Reads the athlete_id cookie, looks up tokens in Supabase, refreshes
 * expired tokens if needed, calls the Strava API, and returns JSON.
 */
export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { data: athlete, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', athleteId)
    .single();
  if (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
    return;
  }
  if (!athlete) {
    res.status(404).json({ error: 'Athlete not found' });
    return;
  }
  let { access_token, refresh_token, token_expires_at } = athlete;
  const expiresAt = token_expires_at ? new Date(token_expires_at).getTime() : 0;
  // Refresh the token if expired
  if (Date.now() > expiresAt) {
    try {
      const clientId = process.env.STRAVA_CLIENT_ID;
      const clientSecret = process.env.STRAVA_CLIENT_SECRET;
      const refreshed = await refreshToken(refresh_token, clientId, clientSecret);
      access_token = refreshed.access_token;
      refresh_token = refreshed.refresh_token;
      token_expires_at = new Date(refreshed.expires_at * 1000).toISOString();
      const { error: updateError } = await supabase
        .from('athletes')
        .update({ access_token, refresh_token, token_expires_at })
        .eq('id', athleteId);
      if (updateError) {
        throw updateError;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to refresh Strava token' });
      return;
    }
  }
  // Default the live dashboard window to the most recent 60 days.
  const since = Math.floor(Date.now() / 1000) - 60 * 24 * 3600;
  try {
    const activities = await getRecentActivities(access_token, since);
    res.status(200).json({ activities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
}
