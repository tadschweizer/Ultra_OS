import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../lib/authServer';
import { getCachedActivitiesForAthlete } from '../../lib/stravaSync';

const STALE_AFTER_HOURS = 12;
const STALE_SYNCING_AFTER_MINUTES = 10;

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    const [{ data: athlete, error: athleteError }, activities] = await Promise.all([
      admin
        .from('athletes')
        .select('id, strava_id, strava_last_sync, strava_sync_status, strava_sync_error, strava_sync_started_at')
        .eq('id', athleteId)
        .maybeSingle(),
      getCachedActivitiesForAthlete({ admin, athleteId }),
    ]);

    if (athleteError) {
      throw athleteError;
    }

    const lastSyncedAt = athlete?.strava_last_sync || null;
    const staleBeforeMs = Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000;
    const syncAgeMs = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;
    const syncStartedMs = athlete?.strava_sync_started_at
      ? new Date(athlete.strava_sync_started_at).getTime()
      : 0;
    const syncStartedRecently = Boolean(
      athlete?.strava_sync_status === 'syncing' &&
        syncStartedMs &&
        Date.now() - syncStartedMs < STALE_SYNCING_AFTER_MINUTES * 60 * 1000
    );
    const needsSync = Boolean(
      athlete?.strava_id && !syncStartedRecently && (!syncAgeMs || syncAgeMs < staleBeforeMs)
    );

    res.status(200).json({
      activities,
      lastSyncedAt,
      syncStatus: syncStartedRecently ? athlete?.strava_sync_status || 'idle' : 'idle',
      syncError: athlete?.strava_sync_error || null,
      hasStravaConnection: Boolean(athlete?.strava_id),
      needsSync,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to load cached activities' });
  }
}
