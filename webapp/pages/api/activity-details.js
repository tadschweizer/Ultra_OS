import { supabase } from '../../lib/supabaseClient';
import { getActivityStreams, getDetailedActivity, refreshToken } from '../../lib/strava';
import cookie from 'cookie';

function summarizeAltitude(streamData = []) {
  if (!Array.isArray(streamData) || streamData.length === 0) {
    return {
      start_altitude_ft: null,
      end_altitude_ft: null,
      average_altitude_ft: null,
      peak_altitude_ft: null,
      low_altitude_ft: null,
    };
  }

  const feetValues = streamData.map((value) => Math.round(value * 3.28084));
  const total = feetValues.reduce((sum, value) => sum + value, 0);

  return {
    start_altitude_ft: feetValues[0] ?? null,
    end_altitude_ft: feetValues[feetValues.length - 1] ?? null,
    average_altitude_ft: feetValues.length ? Math.round(total / feetValues.length) : null,
    peak_altitude_ft: Math.max(...feetValues),
    low_altitude_ft: Math.min(...feetValues),
  };
}

async function getAuthenticatedAthlete(cookies) {
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    return { error: { status: 401, message: 'Not authenticated' } };
  }

  const { data: athlete, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', athleteId)
    .single();

  if (error) {
    return { error: { status: 500, message: error.message } };
  }

  if (!athlete) {
    return { error: { status: 404, message: 'Athlete not found' } };
  }

  let { access_token, refresh_token, token_expires_at } = athlete;
  const expiresAt = token_expires_at ? new Date(token_expires_at).getTime() : 0;

  if (Date.now() > expiresAt) {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const refreshed = await refreshToken(refresh_token, clientId, clientSecret);

    access_token = refreshed.access_token;
    refresh_token = refreshed.refresh_token;
    token_expires_at = new Date(refreshed.expires_at * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('athletes')
      .update({ access_token, refresh_token, token_expires_at })
      .eq('id', athlete.id);

    if (updateError) {
      return { error: { status: 500, message: updateError.message } };
    }
  }

  return { athlete, accessToken: access_token };
}

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const { error, accessToken } = await getAuthenticatedAthlete(cookies);

  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const activityId = req.query.id;
  if (!activityId) {
    res.status(400).json({ error: 'Missing activity id' });
    return;
  }

  try {
    const [activity, streams] = await Promise.all([
      getDetailedActivity(accessToken, activityId),
      getActivityStreams(accessToken, activityId, ['altitude']).catch(() => ({})),
    ]);

    const altitudeSummary = summarizeAltitude(streams?.altitude?.data || []);
    const response = {
      id: activity.id,
      name: activity.name,
      start_date: activity.start_date,
      moving_time: activity.moving_time,
      distance: activity.distance,
      total_elevation_gain: activity.total_elevation_gain,
      elev_high_ft: activity.elev_high ? Math.round(activity.elev_high * 3.28084) : null,
      elev_low_ft: activity.elev_low ? Math.round(activity.elev_low * 3.28084) : null,
      ...altitudeSummary,
    };

    res.status(200).json({ activity: response });
  } catch (requestError) {
    console.error(requestError);
    res.status(500).json({ error: 'Failed to fetch activity details' });
  }
}
