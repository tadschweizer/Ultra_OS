import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../lib/authServer';

const supportedActivityProviders = new Set(['strava', 'garmin', 'trainingpeaks']);

function parseOptionalInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalFloat(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeOptionalText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function clampInteger(value, min, max) {
  if (value === null || value === undefined) return null;
  return Math.min(max, Math.max(min, value));
}

async function loadLinkedActivitySnapshot({ supabase, athleteId, linkedActivityId, linkedActivityProvider }) {
  if (!linkedActivityId) {
    return {
      linked_activity_id: null,
      linked_activity_provider: null,
      linked_activity_snapshot: {},
    };
  }

  if (linkedActivityProvider !== 'strava') {
    return {
      linked_activity_id: String(linkedActivityId),
      linked_activity_provider: linkedActivityProvider,
      linked_activity_snapshot: {
        provider: linkedActivityProvider,
        external_activity_id: String(linkedActivityId),
        resolution_status: 'unresolved_provider_snapshot',
      },
    };
  }

  const { data: activity, error } = await supabase
    .from('strava_activities')
    .select(`
      strava_activity_id,
      name,
      sport_type,
      activity_type,
      start_date,
      timezone,
      distance,
      moving_time,
      elapsed_time,
      total_elevation_gain,
      average_speed,
      max_speed,
      average_heartrate,
      max_heartrate,
      kilojoules,
      trainer,
      commute,
      manual,
      raw_payload
    `)
    .eq('athlete_id', athleteId)
    .eq('strava_activity_id', String(linkedActivityId))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!activity) {
    throw new Error('The linked activity could not be found for this athlete.');
  }

  return {
    linked_activity_id: String(activity.strava_activity_id),
    linked_activity_provider: 'strava',
    linked_activity_snapshot: {
      provider: 'strava',
      external_activity_id: String(activity.strava_activity_id),
      name: activity.name || null,
      sport_type: activity.sport_type || null,
      activity_type: activity.activity_type || null,
      start_date: activity.start_date || null,
      timezone: activity.timezone || null,
      distance_meters: activity.distance ?? null,
      moving_time_seconds: activity.moving_time ?? null,
      elapsed_time_seconds: activity.elapsed_time ?? null,
      elevation_gain_meters: activity.total_elevation_gain ?? null,
      average_speed_mps: activity.average_speed ?? null,
      max_speed_mps: activity.max_speed ?? null,
      average_heartrate_bpm: activity.average_heartrate ?? null,
      max_heartrate_bpm: activity.max_heartrate ?? null,
      kilojoules: activity.kilojoules ?? null,
      trainer: Boolean(activity.trainer),
      commute: Boolean(activity.commute),
      manual: Boolean(activity.manual),
      raw_payload: activity.raw_payload || {},
    },
  };
}

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  const supabase = getSupabaseAdminClient();

  if (!athleteId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('race_outcomes')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('race_date', { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ outcomes: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const raceName = normalizeOptionalText(body.race_name);

    if (!raceName) {
      return res.status(400).json({ error: 'Race name is required' });
    }

    const linkedActivityId = normalizeOptionalText(body.linked_activity_id);
    const linkedActivityProvider = normalizeOptionalText(body.linked_activity_provider);

    if (linkedActivityProvider && !supportedActivityProviders.has(linkedActivityProvider)) {
      return res.status(400).json({ error: 'Unsupported activity provider' });
    }

    try {
      const linkedActivity = await loadLinkedActivitySnapshot({
        supabase,
        athleteId,
        linkedActivityId,
        linkedActivityProvider,
      });

      const payload = {
        athlete_id: athleteId,
        race_name: raceName,
        race_date: body.race_date || null,
        race_type: normalizeOptionalText(body.race_type),
        finish_outcome: normalizeOptionalText(body.finish_outcome),
        finish_time_minutes: parseOptionalInt(body.finish_time_minutes),
        goal_time_minutes: parseOptionalInt(body.goal_time_minutes),
        overall_rating: clampInteger(parseOptionalInt(body.overall_rating), 1, 10),
        gi_distress_score: clampInteger(parseOptionalInt(body.gi_distress_score), 0, 4),
        energy_management: normalizeOptionalText(body.energy_management),
        pacing_strategy: normalizeOptionalText(body.pacing_strategy),
        primary_limiter: normalizeOptionalText(body.primary_limiter),
        peak_hr_bpm: parseOptionalInt(body.peak_hr_bpm),
        avg_hr_bpm: parseOptionalInt(body.avg_hr_bpm),
        avg_carbs_g_per_hr: parseOptionalFloat(body.avg_carbs_g_per_hr),
        total_fluid_l: parseOptionalFloat(body.total_fluid_l),
        heat_impact: normalizeOptionalText(body.heat_impact),
        what_worked: normalizeOptionalText(body.what_worked),
        what_to_change: normalizeOptionalText(body.what_to_change),
        would_use_again: normalizeOptionalText(body.would_use_again),
        notes: normalizeOptionalText(body.notes),
        ...linkedActivity,
      };

      const { data, error } = await supabase
        .from('race_outcomes')
        .insert(payload)
        .select('id, race_name, race_date, linked_activity_id')
        .single();

      if (error) {
        console.error(error);
        if (error.code === '42P01') {
          return res.status(503).json({ error: 'race_outcomes table not yet created. Run the migration.' });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ outcome: data });
    } catch (requestError) {
      console.error(requestError);
      return res.status(400).json({ error: requestError.message || 'Failed to save race outcome' });
    }
  }

  return res.status(405).end();
}
