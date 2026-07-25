import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';
import { getEffectiveAthleteIdFromRequest } from '../../lib/auth/requireAthlete.js';
import { syncAthleteActivities } from '../../lib/activitySync';

// Covers the full chronic-load window (6 weeks) needed for ATL/CTL/TSB.
const DEFAULT_LOOKBACK_DAYS = 42;
const MAX_LOOKBACK_DAYS = 730;

/**
 * Recent imported activities for the authenticated athlete.
 *
 * This route used to call the Strava API on every request and return the
 * response without saving it, which is why the calendar — which reads the
 * database — showed nothing while this endpoint showed a full week. It now
 * refreshes the stored copy and serves from the database, so every surface
 * reads the same rows.
 */
export default async function handler(req, res) {
  const athleteId = await getEffectiveAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const requestedDays = Number(req.query.days);
  const lookbackDays = requestedDays > 0
    ? Math.min(requestedDays, MAX_LOOKBACK_DAYS)
    : DEFAULT_LOOKBACK_DAYS;
  const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();

  // Refresh first so a just-finished session appears. A throttled or failed
  // sync is not an error — stored activities still render.
  const sync = await syncAthleteActivities(admin, athleteId);

  const { data, error } = await admin
    .from('strava_activities')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('start_date', since)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('[activities] read failed:', error.message);
    res.status(500).json({ error: 'Failed to load activities' });
    return;
  }

  res.status(200).json({
    activities: data || [],
    sync: { synced: sync.synced, skipped: sync.skipped, reason: sync.reason || null },
  });
}
