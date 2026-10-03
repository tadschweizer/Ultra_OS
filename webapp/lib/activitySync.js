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
import { refreshToken, getRecentActivities, getDetailedActivity } from './strava.js';
import { estimateTssFromActivity } from './trainingLoad.js';
import { classifyStravaSyncError } from './stravaSyncStatus.js';

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
export async function ensureStravaAccessToken(admin, athlete, refresh = refreshToken) {
  if (!athlete?.strava_id || !athlete.access_token || !athlete.refresh_token) return null;

  const expiresAt = athlete.token_expires_at ? new Date(athlete.token_expires_at).getTime() : 0;
  // Refresh a minute early so a token does not expire mid-request.
  if (Date.now() < expiresAt - 60000) return athlete.access_token;

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const refreshed = await refresh(athlete.refresh_token, clientId, clientSecret);
  if (!refreshed?.access_token || !refreshed?.refresh_token || !Number.isFinite(refreshed.expires_at)) {
    throw new Error('Invalid token refresh response');
  }
  const { data, error } = await admin
    .from('athletes')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    })
    .eq('id', athlete.id).eq('strava_id', athlete.strava_id).eq('refresh_token', athlete.refresh_token)
    .select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Strava connection changed during refresh');

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
export function createActivitySync({ listActivities = getRecentActivities, refresh = refreshToken,
  detailActivity = getDetailedActivity } = {}) {
return async function sync(admin, athleteId, { force = false, since = null } = {}) {
  let lease = null;
  try {
    const { data: athlete, error: lookupError } = await admin
      .from('athletes')
      .select('id, strava_id, access_token, refresh_token, token_expires_at, last_activity_sync_at, activity_backfill_completed_at')
      .eq('id', athleteId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!athlete) return { synced: 0, skipped: true, reason: 'athlete_not_found' };
    if (!athlete.strava_id) return { synced: 0, skipped: true, reason: 'not_connected' };

    const isBackfill = !athlete.activity_backfill_completed_at;
    if (since && !Number.isFinite(toEpochSeconds(since))) throw new Error('Invalid import range');
    const { data: claim, error: claimError } = await admin.rpc('claim_strava_sync', {
      p_athlete_id: athleteId, p_strava_id: athlete.strava_id, p_force: force, p_history: Boolean(since),
    });
    if (claimError) throw claimError;
    if (!claim?.lease_token) return { synced: 0, skipped: true, reason: claim?.reason || 'in_progress', retryAt: claim?.retry_at || null };
    lease = claim.lease_token;

    const accessToken = await ensureStravaAccessToken(admin, athlete, refresh);
    if (!accessToken) throw Object.assign(new Error('Strava authorization unavailable'), { response: { status: 401 } });

    const after = since
      ? toEpochSeconds(since)
      : daysAgoEpoch(isBackfill ? BACKFILL_WINDOW_DAYS : INCREMENTAL_WINDOW_DAYS);

    const activities = await listActivities(accessToken, after);
    if (!Array.isArray(activities)) throw new Error('Invalid activities response');
    if (claim.activity_id) {
      // Webhook edits can refer to training older than the rolling import window.
      // Drain one specific activity per lease, keeping each job within its budget.
      try {
        const detail = await detailActivity(accessToken, claim.activity_id);
        if (String(detail?.id) !== claim.activity_id) throw new Error('Unexpected activity identity');
        activities.push(detail);
      } catch (error) {
        if (error.response?.status === 404) {
          const deleted = await admin.rpc('handle_strava_event', { p_owner_id: athlete.strava_id,
            p_activity_id: claim.activity_id, p_action: 'delete' });
          if (deleted.error) throw deleted.error;
          return { synced: 0, skipped: true, reason: 'source_deleted' };
        }
        throw error;
      }
    }
    // Reject malformed records instead of claiming a partial import succeeded.
    if (activities.some(a => !/^\d+$/.test(String(a?.id || '')) || !a.start_date || !Number.isFinite(Date.parse(a.start_date)))) {
      throw new Error('Invalid activity record');
    }
    const rows = [...new Map(activities.map(a => [String(a.id), toActivityRow(athleteId, a)])).values()];
    const { data: finished, error: finishError } = await admin.rpc('finish_strava_sync', {
      p_athlete_id: athleteId, p_strava_id: athlete.strava_id, p_lease_token: lease,
      p_rows: rows, p_backfilled: isBackfill && !since,
    });
    if (finishError) throw finishError;
    return { synced: finished.synced, skipped: false, backfilled: isBackfill && !since };
  } catch (error) {
    // A sync failure must never take down a page — stored data still renders.
    const failure = classifyStravaSyncError(error);
    console.error('[activitySync] failed:', { code: failure.code });
    if (lease) {
      try { await admin.rpc('release_strava_sync', { p_athlete_id: athleteId,
        p_lease_token: lease, p_error: failure.code, p_retry_seconds: failure.retrySeconds }); } catch { /* lease expires */ }
    }
    return { synced: 0, skipped: true, reason: failure.code, message: failure.message };
  }
};
}
export const syncAthleteActivities = createActivitySync();

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
