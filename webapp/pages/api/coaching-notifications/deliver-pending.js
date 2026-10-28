import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { coachingAvailability } from '../../../lib/coachingNotifications.js';
import { deliverCoachingNotification } from '../../../lib/coachingNotificationDelivery.js';

export function createCoachingWorker({ getClient = getSupabaseAdminClient, send = deliverCoachingNotification,
  availability = coachingAvailability, secret = () => process.env.COACHING_NOTIFICATION_WORKER_SECRET } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
    const expected = secret();
    if (!expected || expected.length < 32) return res.status(503).json({ error: 'Worker unavailable.' });
    const supplied = Buffer.from(String(req.headers.authorization || '')), required = Buffer.from(`Bearer ${expected}`);
    if (supplied.length !== required.length || !crypto.timingSafeEqual(supplied, required)) return res.status(401).json({ error: 'Not authenticated.' });
    try {
      const admin = getClient(), available = availability();
      let processed = 0, accepted = 0;
      const deadline = Date.now() + 40000;
      for (const channel of ['email', 'sms']) {
        if (!available[channel]) continue;
        for (let count = 0; count < 5 && Date.now() < deadline; count++) {
          const { data: job, error } = await admin.rpc('claim_coaching_notification', { p_channel: channel });
          if (error) throw error;
          if (!job) break;
          processed++;
          if (job.skipped) continue;
          let result;
          try { result = await send(job); } catch { result = { outcome: channel === 'sms' ? 'uncertain' : 'retry' }; }
          if (result.stopped) {
            const { error: stopError } = await admin.from('coaching_notification_settings').update({ sms_stopped_at: new Date().toISOString() }).eq('phone', job.phone);
            if (stopError) throw stopError;
          }
          const { data: finished, error: finishError } = await admin.rpc('finish_coaching_notification', {
            p_id: job.id, p_lease: job.lease_token, p_outcome: result.outcome, p_provider: result.providerId || null,
          });
          if (finishError || !finished) throw finishError || new Error('Lease expired');
          if (result.outcome === 'accepted') accepted++;
        }
      }
      return res.status(200).json({ processed, accepted });
    } catch { return res.status(503).json({ error: 'Delivery could not complete. Check the delivery queue before retrying.' }); }
  };
}
export const config = { maxDuration: 60 };
export default createCoachingWorker();
