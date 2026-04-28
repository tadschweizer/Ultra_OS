import { getSupabaseAdminClient } from '../../../lib/authServer';
import { getAthletesDueForStravaSync, syncAthleteStravaActivities } from '../../../lib/stravaSync';

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const header = req.headers.authorization || '';
  return header === `Bearer ${cronSecret}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const staleBefore = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  try {
    const athletes = await getAthletesDueForStravaSync({
      admin,
      staleBeforeIso: staleBefore,
      limit: 25,
    });

    const results = [];
    for (const athlete of athletes) {
      try {
        const result = await syncAthleteStravaActivities({
          admin,
          athlete,
          force: true,
        });
        results.push({ athleteId: athlete.id, ok: true, ...result });
      } catch (error) {
        console.error(`[cron/strava-sync] athlete ${athlete.id} failed:`, error);
        results.push({
          athleteId: athlete.id,
          ok: false,
          error: error.message || 'Sync failed.',
        });
      }
    }

    res.status(200).json({
      processed: results.length,
      synced: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    });
  } catch (error) {
    console.error('[cron/strava-sync] failed:', error);
    res.status(500).json({ error: error.message || 'Failed to run Strava cron sync.' });
  }
}
