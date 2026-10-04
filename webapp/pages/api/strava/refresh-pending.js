import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { syncAthleteActivities } from '../../../lib/activitySync.js';

// Call from an explicitly configured scheduler. One athlete per invocation,
// with database lease/cooldown coordination across workers and page requests.
export function createStravaRefreshHandler({ getClient = getSupabaseAdminClient,
  sync = syncAthleteActivities, secret = () => process.env.STRAVA_SYNC_WORKER_SECRET } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
    const expected=secret();
    if(!expected || expected.length<32)return res.status(503).json({error:'Worker unavailable.'});
    const actual=String(req.headers.authorization||'');const required=`Bearer ${expected}`;
    if(Buffer.byteLength(actual)!==Buffer.byteLength(required)||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(required))) {
      return res.status(401).json({error:'Not authenticated.'});
    }
    try {
      const admin=getClient();const {data:athleteId,error}=await admin.rpc('pending_strava_sync');if(error)throw error;
      if(!athleteId)return res.status(200).json({processed:0});
      const result=await sync(admin,athleteId);
      return res.status(result.reason==='error'?503:200).json({processed:1,...result});
    } catch { return res.status(503).json({error:'Refresh could not complete. Retry this job.'}); }
  };
}
export const config={maxDuration:60};
export default createStravaRefreshHandler();
