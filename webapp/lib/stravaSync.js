import { getSupabaseAdminClient } from './authServer';
import { createWorkoutUploadNotification } from './notificationServer';
import {
  recordActivityEvent,
  upsertActivityFollowUpPrompts,
  upsertProviderConnection,
} from './providerEvents';
import { getRecentActivities, refreshToken } from './strava';

const DEFAULT_SYNC_LOOKBACK_DAYS = 60;
const MIN_SYNC_INTERVAL_MS = 15 * 60 * 1000;

function buildFallbackAfterTimestamp(days = DEFAULT_SYNC_LOOKBACK_DAYS) {
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

function normalizeActivityRow(activity, athleteId) {
  return {
    athlete_id: athleteId,
    strava_activity_id: String(activity.id),
    name: activity.name || null,
    sport_type: activity.sport_type || activity.type || null,
    activity_type: activity.type || null,
    start_date: activity.start_date || null,
    timezone: activity.timezone || null,
    distance: activity.distance ?? 0,
    moving_time: activity.moving_time ?? 0,
    elapsed_time: activity.elapsed_time ?? null,
    total_elevation_gain: activity.total_elevation_gain ?? 0,
    average_speed: activity.average_speed ?? null,
    max_speed: activity.max_speed ?? null,
    average_heartrate: activity.average_heartrate ?? null,
    max_heartrate: activity.max_heartrate ?? null,
    kilojoules: activity.kilojoules ?? null,
    trainer: Boolean(activity.trainer),
    commute: Boolean(activity.commute),
    manual: Boolean(activity.manual),
    raw_payload: activity,
    synced_at: new Date().toISOString(),
  };
}

async function ensureStravaProviderConnection(admin, athlete) {
  if (!athlete?.id || !athlete?.strava_id) return null;

  return upsertProviderConnection(admin, {
    athleteId: athlete.id,
    provider: 'strava',
    providerAthleteId: athlete.strava_id,
    accessToken: athlete.access_token || null,
    refreshToken: athlete.refresh_token || null,
    tokenExpiresAt: athlete.token_expires_at || null,
    lastError: null,
    metadata: {
      sync_source: 'strava_sync',
    },
  });
}

async function ensureFreshAccessToken(admin, athlete) {
  let accessToken = athlete.access_token;
  let refreshTokenValue = athlete.refresh_token;
  let tokenExpiresAt = athlete.token_expires_at;
  const expiresAtMs = tokenExpiresAt ? new Date(tokenExpiresAt).getTime() : 0;

  if (Date.now() <= expiresAtMs && accessToken) {
    return { accessToken, refreshToken: refreshTokenValue, tokenExpiresAt };
  }

  if (!refreshTokenValue) {
    throw new Error('Missing Strava refresh token.');
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET.');
  }

  const refreshed = await refreshToken(refreshTokenValue, clientId, clientSecret);
  accessToken = refreshed.access_token;
  refreshTokenValue = refreshed.refresh_token;
  tokenExpiresAt = new Date(refreshed.expires_at * 1000).toISOString();

  const { error } = await admin
    .from('athletes')
    .update({
      access_token: accessToken,
      refresh_token: refreshTokenValue,
      token_expires_at: tokenExpiresAt,
    })
    .eq('id', athlete.id);

  if (error) {
    throw error;
  }

  await ensureStravaProviderConnection(admin, {
    ...athlete,
    access_token: accessToken,
    refresh_token: refreshTokenValue,
    token_expires_at: tokenExpiresAt,
  });

  return { accessToken, refreshToken: refreshTokenValue, tokenExpiresAt };
}

async function markSyncState(admin, athleteId, updates) {
  const { error } = await admin
    .from('athletes')
    .update(updates)
    .eq('id', athleteId);

  if (error) {
    throw error;
  }
}

export async function syncAthleteStravaActivities({
  admin = getSupabaseAdminClient(),
  athleteId,
  athlete = null,
  force = false,
  lookbackDays = DEFAULT_SYNC_LOOKBACK_DAYS,
} = {}) {
  if (!athleteId && !athlete?.id) {
    throw new Error('syncAthleteStravaActivities requires athleteId or athlete.');
  }

  const targetAthleteId = athlete?.id || athleteId;
  let athleteRecord = athlete;
  if (!athleteRecord) {
    const { data, error } = await admin
      .from('athletes')
      .select('id, strava_id, access_token, refresh_token, token_expires_at, strava_last_sync')
      .eq('id', targetAthleteId)
      .maybeSingle();

    if (error) throw error;
    athleteRecord = data;
  }

  if (!athleteRecord?.strava_id) {
    return {
      synced: false,
      skipped: true,
      reason: 'not_connected',
      activityCount: 0,
      lastSyncedAt: athleteRecord?.strava_last_sync || null,
    };
  }

  const lastSyncMs = athleteRecord?.strava_last_sync
    ? new Date(athleteRecord.strava_last_sync).getTime()
    : 0;
  const hadPreviousSync = Boolean(athleteRecord?.strava_last_sync);

  if (!force && lastSyncMs && Date.now() - lastSyncMs < MIN_SYNC_INTERVAL_MS) {
    return {
      synced: false,
      skipped: true,
      reason: 'recently_synced',
      activityCount: 0,
      lastSyncedAt: athleteRecord.strava_last_sync,
    };
  }

  await markSyncState(admin, targetAthleteId, {
    strava_sync_status: 'syncing',
    strava_sync_error: null,
    strava_sync_started_at: new Date().toISOString(),
  });

  try {
    const providerConnection = await ensureStravaProviderConnection(admin, athleteRecord);
    const {
      accessToken,
      refreshToken: freshRefreshToken,
      tokenExpiresAt: freshTokenExpiresAt,
    } = await ensureFreshAccessToken(admin, athleteRecord);
    const afterTimestamp = athleteRecord?.strava_last_sync
      ? Math.floor(new Date(athleteRecord.strava_last_sync).getTime() / 1000) - 3600
      : buildFallbackAfterTimestamp(lookbackDays);

    const activities = await getRecentActivities(accessToken, afterTimestamp);
    const activityRows = activities.map((activity) => normalizeActivityRow(activity, targetAthleteId));
    const activityIds = activityRows.map((activity) => activity.strava_activity_id);
    let existingActivityIds = new Set();

    if (activityIds.length) {
      const { data: existingRows, error: existingRowsError } = await admin
        .from('strava_activities')
        .select('strava_activity_id')
        .eq('athlete_id', targetAthleteId)
        .in('strava_activity_id', activityIds);

      if (existingRowsError) {
        throw existingRowsError;
      }

      existingActivityIds = new Set((existingRows || []).map((row) => String(row.strava_activity_id)));
    }

    if (activityRows.length) {
      const { error: upsertError } = await admin
        .from('strava_activities')
        .upsert(activityRows, { onConflict: 'athlete_id,strava_activity_id' });

      if (upsertError) {
        throw upsertError;
      }
    }

    if (hadPreviousSync) {
      const newActivities = activityRows.filter(
        (activity) => !existingActivityIds.has(String(activity.strava_activity_id))
      );

      for (const activity of newActivities) {
        const activityEvent = await recordActivityEvent(admin, {
          athleteId: targetAthleteId,
          providerConnectionId: providerConnection?.id || null,
          provider: 'strava',
          eventKind: 'activity_imported',
          externalEventId: `strava-sync:${targetAthleteId}:${activity.strava_activity_id}`,
          externalActivityId: activity.strava_activity_id,
          providerAthleteId: athleteRecord.strava_id,
          occurredAt: activity.start_date || new Date().toISOString(),
          payload: {
            source: force ? 'forced_sync' : 'scheduled_sync',
            activity,
          },
          eventStatus: 'processed',
          processingNotes: 'Imported from Strava sync.',
        });
        await createWorkoutUploadNotification(admin, {
          athleteId: targetAthleteId,
          activity,
        });
        await upsertActivityFollowUpPrompts(admin, {
          athleteId: targetAthleteId,
          activityEventId: activityEvent?.id || null,
          provider: 'strava',
          activity,
        });
      }
    }

    const syncedAt = new Date().toISOString();
    if (providerConnection?.id) {
      await upsertProviderConnection(admin, {
        athleteId: targetAthleteId,
        provider: 'strava',
        providerAthleteId: athleteRecord.strava_id,
        accessToken,
        refreshToken: freshRefreshToken || athleteRecord.refresh_token || null,
        tokenExpiresAt: freshTokenExpiresAt || athleteRecord.token_expires_at || null,
        lastSyncAt: syncedAt,
        lastError: null,
        metadata: {
          sync_source: force ? 'forced_sync' : 'scheduled_sync',
        },
      });
    }
    await markSyncState(admin, targetAthleteId, {
      strava_last_sync: syncedAt,
      strava_sync_status: 'idle',
      strava_sync_error: null,
      strava_sync_started_at: null,
    });

    return {
      synced: true,
      skipped: false,
      reason: null,
      activityCount: activityRows.length,
      lastSyncedAt: syncedAt,
    };
  } catch (error) {
    if (athleteRecord?.strava_id) {
      await upsertProviderConnection(admin, {
        athleteId: targetAthleteId,
        provider: 'strava',
        providerAthleteId: athleteRecord.strava_id,
        accessToken: athleteRecord.access_token || null,
        refreshToken: athleteRecord.refresh_token || null,
        tokenExpiresAt: athleteRecord.token_expires_at || null,
        lastError: error.message || 'Strava sync failed.',
        metadata: {
          sync_source: force ? 'forced_sync' : 'scheduled_sync',
        },
      });
    }
    await markSyncState(admin, targetAthleteId, {
      strava_sync_status: 'error',
      strava_sync_error: error.message || 'Strava sync failed.',
      strava_sync_started_at: null,
    });
    throw error;
  }
}

export async function getCachedActivitiesForAthlete({
  admin = getSupabaseAdminClient(),
  athleteId,
}) {
  const { data, error } = await admin
    .from('strava_activities')
    .select('strava_activity_id, name, start_date, moving_time, elapsed_time, distance, total_elevation_gain, activity_type, sport_type, average_heartrate, max_heartrate, kilojoules')
    .eq('athlete_id', athleteId)
    .order('start_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((activity) => ({
    id: activity.strava_activity_id,
    provider: 'strava',
      name: activity.name,
      start_date: activity.start_date,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      distance: activity.distance,
      total_elevation_gain: activity.total_elevation_gain,
      type: activity.activity_type,
      sport_type: activity.sport_type,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      kilojoules: activity.kilojoules,
    }));
}

export async function getAthletesDueForStravaSync({
  admin = getSupabaseAdminClient(),
  staleBeforeIso,
  limit = 25,
}) {
  let query = admin
    .from('athletes')
    .select('id, strava_id, access_token, refresh_token, token_expires_at, strava_last_sync')
    .not('strava_id', 'is', null)
    .not('refresh_token', 'is', null)
    .order('strava_last_sync', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (staleBeforeIso) {
    query = query.or(`strava_last_sync.is.null,strava_last_sync.lt.${staleBeforeIso}`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data || [];
}
