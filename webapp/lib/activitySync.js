/**
 * Persistence for imported training.
 *
 * Imported activities used to be read straight from the Strava API on every
 * request and never stored, so the calendar — which reads the database — saw
 * nothing. This module is the single write path: it refreshes the athlete's
 * token, pulls activities, and upserts them into strava_activities.
 *
 * Sync is throttled per athlete so a page with several widgets triggers at
 * most one upstream call, and it never throws: a provider outage degrades to
 * "no new data", leaving whatever is already stored intact.
 */

// Extensioned paths so `node --test` can resolve these directly, without a bundler.
import { refreshToken, getRecentActivities } from './strava.js';
import { estimateTssFromActivity } from './trainingLoad.js';

/** Minimum gap between upstream pulls for one athlete. */
const SYNC_THROTTLE_MS = 10 * 60 * 1000;

/** Rolling window pulled on a routine sync. */
const INCREMENTAL_WINDOW_DAYS = 60;

/** How far back the one-time backfill reaches on first sync. */
const BACKFILL_WINDOW_DAYS = 730;

function toEpochSeconds(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

function daysAgoEpoch(days) {
  return Math.floor((Date.now() - days * 86400000) / 1000);
}

/**
 * Strava reports start_date_local as a wall-clock time mislabelled with a "Z"
 * suffix. Stripping the suffix keeps it a naive local timestamp, which is what
 * the calendar needs to place a session on the athlete's own day.
 */
function parseLocalStart(activity) {
  const local = activity.start_date_local;
  if (typeof local === 'string' && local.length >= 10) {
    return { startDateLocal: local.replace(/Z$/, ''), localDate: local.slice(0, 10) };
  }
  if (activity.start_date) {
    const offsetSec = Number(activity.utc_offset) || 0;
    const shifted = new Date(new Date(activity.start_date).getTime() + offsetSec * 1000);
    const iso = shifted.toISOString();
    return { startDateLocal: iso.replace(/Z$/, ''), localDate: iso.slice(0, 10) };
  }
  return { startDateLocal: null, localDate: null };
}

// Number(null) and Number('') are both 0, which would store a missing heart
// rate as a real reading of 0 bpm. Absent values must stay absent.
function num(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Maps a Strava API activity onto a strava_activities row. */
export function toActivityRow(athleteId, activity) {
  const { startDateLocal, localDate } = parseLocalStart(activity);
  const movingTime = num(activity.moving_time);
  const load = estimateTssFromActivity({
    movingTimeSec: movingTime,
    averageHeartrate: num(activity.average_heartrate),
    sportType: activity.sport_type || activity.type,
  });

  return {
    athlete_id: athleteId,
    strava_activity_id: String(activity.id),
    name: activity.name || null,
    sport_type: activity.sport_type || activity.type || null,
    activity_type: activity.type || null,
    start_date: activity.start_date || null,
    start_date_local: startDateLocal,
    local_date: localDate,
    utc_offset: num(activity.utc_offset),
    timezone: activity.timezone || null,
    distance: num(activity.distance),
    moving_time: movingTime,
    elapsed_time: num(activity.elapsed_time),
    total_elevation_gain: num(activity.total_elevation_gain),
    elev_high: num(activity.elev_high),
    elev_low: num(activity.elev_low),
    average_speed: num(activity.average_speed),
    max_speed: num(activity.max_speed),
    average_heartrate: num(activity.average_heartrate),
    max_heartrate: num(activity.max_heartrate),
    average_cadence: num(activity.average_cadence),
    has_heartrate: activity.has_heartrate ?? null,
    kilojoules: num(activity.kilojoules),
    calories: num(activity.calories),
    suffer_score: num(activity.suffer_score),
    workout_type: activity.workout_type != null ? String(activity.workout_type) : null,
    description: activity.description || null,
    trainer: activity.trainer ?? null,
    commute: activity.commute ?? null,
    manual: activity.manual ?? null,
    tss: load.tss,
    intensity_factor: load.intensityFactor,
    source: 'strava',
    raw_payload: activity,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Returns a usable Strava access token, refreshing and persisting it when the
 * stored one has expired. Returns null when the athlete has no connection.
 */
export async function ensureStravaAccessToken(admin, athlete) {
  if (!athlete?.strava_id || !athlete.access_token || !athlete.refresh_token) return null;

  const expiresAt = athlete.token_expires_at ? new Date(athlete.token_expires_at).getTime() : 0;
  // Refresh a minute early so a token does not expire mid-request.
  if (Date.now() < expiresAt - 60000) return athlete.access_token;

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const refreshed = await refreshToken(athlete.refresh_token, clientId, clientSecret);
  await admin
    .from('athletes')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    })
    .eq('id', athlete.id);

  return refreshed.access_token;
}

/**
 * Pulls activities from Strava and upserts them.
 *
 * The first sync for an athlete reaches back BACKFILL_WINDOW_DAYS so existing
 * history appears immediately; later syncs only cover a rolling window. Pass
 * `force` to bypass the throttle, or `since` to widen a single run (used when
 * the caller needs a range older than what has been backfilled).
 */
export async function syncAthleteActivities(admin, athleteId, { force = false, since = null } = {}) {
  try {
    const { data: athlete } = await admin
      .from('athletes')
      .select('id, strava_id, access_token, refresh_token, token_expires_at, last_activity_sync_at, activity_backfill_completed_at')
      .eq('id', athleteId)
      .maybeSingle();

    if (!athlete) return { synced: 0, skipped: true, reason: 'athlete_not_found' };
    if (!athlete.strava_id) return { synced: 0, skipped: true, reason: 'not_connected' };

    const isBackfill = !athlete.activity_backfill_completed_at;
    const lastSync = athlete.last_activity_sync_at ? new Date(athlete.last_activity_sync_at).getTime() : 0;
    const throttled = !force && !isBackfill && !since && Date.now() - lastSync < SYNC_THROTTLE_MS;
    if (throttled) return { synced: 0, skipped: true, reason: 'throttled' };

    const accessToken = await ensureStravaAccessToken(admin, athlete);
    if (!accessToken) return { synced: 0, skipped: true, reason: 'no_token' };

    const after = since
      ? toEpochSeconds(since)
      : daysAgoEpoch(isBackfill ? BACKFILL_WINDOW_DAYS : INCREMENTAL_WINDOW_DAYS);

    const activities = await getRecentActivities(accessToken, after);
    const rows = (activities || [])
      .filter((activity) => activity?.id && activity.start_date)
      .map((activity) => toActivityRow(athleteId, activity));

    if (rows.length) {
      const { error: upsertError } = await admin
        .from('strava_activities')
        .upsert(rows, { onConflict: 'athlete_id,strava_activity_id' });
      if (upsertError) throw upsertError;
    }

    const stamps = { last_activity_sync_at: new Date().toISOString(), last_activity_sync_error: null };
    // Only a full-history run clears the backfill flag — a narrowed `since`
    // run must not mark partial history as complete.
    if (isBackfill && !since) stamps.activity_backfill_completed_at = new Date().toISOString();
    await admin.from('athletes').update(stamps).eq('id', athleteId);

    return { synced: rows.length, skipped: false, backfilled: isBackfill && !since };
  } catch (error) {
    // A sync failure must never take down a page — stored data still renders.
    console.error('[activitySync] failed for athlete', athleteId, error?.message || error);
    await admin
      .from('athletes')
      .update({ last_activity_sync_at: new Date().toISOString(), last_activity_sync_error: String(error?.message || error).slice(0, 500) })
      .eq('id', athleteId)
      .then(() => {}, () => {});
    return { synced: 0, skipped: true, reason: 'error', error: String(error?.message || error) };
  }
}

/**
 * Reads stored activities for a calendar range.
 *
 * Matches on local_date so a session sits on the athlete's own day, falling
 * back to the UTC instant for legacy rows imported before local_date existed.
 */
export async function getStoredActivities(admin, athleteId, start, end) {
  const { data, error } = await admin
    .from('strava_activities')
    .select('*')
    .eq('athlete_id', athleteId)
    .or(`and(local_date.gte.${start},local_date.lte.${end}),and(local_date.is.null,start_date.gte.${start}T00:00:00Z,start_date.lte.${end}T23:59:59Z)`)
    .order('start_date', { ascending: true });

  if (error) {
    console.error('[activitySync] read failed:', error.message);
    return [];
  }
  return data || [];
}
