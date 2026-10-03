import { getAthleteByCookie, getSupabaseAdminClient } from '../../../lib/authServer.js';
import { getViewAsIdFromRequest } from '../../../lib/auth/sessionCookies.js';
import { requireSameOriginJson } from '../../../lib/billingSecurity.js';
import { syncAthleteActivities, ensureStravaAccessToken } from '../../../lib/activitySync.js';
import { deauthorize } from '../../../lib/strava.js';
import { publicStravaSyncStatus } from '../../../lib/stravaSyncStatus.js';

export function createStravaConnectionHandler({ getClient = getSupabaseAdminClient,
  getAthlete = getAthleteByCookie, sync = syncAthleteActivities,
  revoke = deauthorize, getToken = ensureStravaAccessToken } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, DELETE'); return res.status(405).json({ error: 'Method not allowed.' });
    }
    if (req.method !== 'GET' && !requireSameOriginJson(req, res, req.method)) return;
    if (getViewAsIdFromRequest(req)) return res.status(403).json({ error: 'Return to your own account to manage Strava.' });
    try {
      const admin = getClient();
      const athlete = await getAthlete(req, admin);
      if (!athlete) return res.status(401).json({ error: 'Please sign in to manage Strava.' });
      if (req.method === 'DELETE') {
        if (req.body?.confirm !== 'DISCONNECT STRAVA') return res.status(400).json({ error: 'Confirm the Strava disconnect first.' });
        if (!athlete.strava_id) return res.status(200).json({ disconnected: true, removed: 0 });
        if (!athlete.supabase_user_id) return res.status(409).json({ error: 'Add an email or Google sign-in before disconnecting your only sign-in method.' });
        let providerCleanup = 'done';
        try {
          const token = await getToken(admin, athlete);
          if (!token) throw new Error('No provider token');
          await revoke(token);
        } catch { providerCleanup = 'failed'; }
        const { data, error } = await admin.rpc('disconnect_strava', { p_athlete_id: athlete.id, p_strava_id: athlete.strava_id });
        if (error) throw error;
        return res.status(200).json({ disconnected: true, removed: data.removed, providerCleanup });
      }
      let imported = null;
      if (req.method === 'POST') imported = await sync(admin, athlete.id, { force: true });
      const { data: current, error } = await admin.from('athletes')
        .select('strava_id,last_activity_sync_at,activity_backfill_completed_at,last_activity_sync_error')
        .eq('id', athlete.id).single();
      if (error) throw error;
      const { count, error: countError } = await admin.from('strava_activities')
        .select('id', { count: 'exact', head: true }).eq('athlete_id', athlete.id);
      if (countError) throw countError;
      return res.status(200).json({ ...publicStravaSyncStatus(current), activityCount: count || 0,
        canDisconnect: Boolean(athlete.supabase_user_id), ...(imported ? { sync: imported } : {}) });
    } catch {
      return res.status(503).json({ error: 'Strava connection details could not be updated. Please try again.' });
    }
  };
}
export default createStravaConnectionHandler();
export const config = { maxDuration: 60 };
