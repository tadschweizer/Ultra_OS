import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../../lib/authServer';
import { syncAthleteStravaActivities } from '../../../lib/stravaSync';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const result = await syncAthleteStravaActivities({
      admin: getSupabaseAdminClient(),
      athleteId,
      force: req.body?.force === true,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[strava/sync] failed:', error);
    res.status(500).json({ error: error.message || 'Failed to sync Strava data.' });
  }
}
