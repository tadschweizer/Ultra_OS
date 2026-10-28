import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../../../lib/authServer.js';

export function validTwilioSignature(url, body, signature, secret) {
  if (!url || !secret || !body || typeof body !== 'object') return false;
  if (Object.values(body).some(value => typeof value !== 'string')) return false;
  const payload = url + Object.keys(body).sort().map(key => key + body[key]).join('');
  const expected = Buffer.from(crypto.createHmac('sha1', secret).update(payload).digest('base64'));
  const supplied = Buffer.from(String(signature || ''));
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

export function createSmsEventsHandler({ getClient = getSupabaseAdminClient, env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!validTwilioSignature(env.TWILIO_INBOUND_WEBHOOK_URL, req.body, req.headers['x-twilio-signature'], env.TWILIO_AUTH_TOKEN)
      || req.body.AccountSid !== env.TWILIO_ACCOUNT_SID || req.body.MessagingServiceSid !== env.TWILIO_MESSAGING_SERVICE_SID) {
      return res.status(403).end();
    }
    try {
      // START never silently restores website consent. Reverification is required.
      if (req.body.OptOutType === 'STOP' || /^(stop|stopall|unsubscribe|cancel|end|quit|revoke|optout)$/i.test(req.body.Body?.trim() || '')) {
        const { error } = await getClient().from('coaching_notification_settings').update({ sms_stopped_at: new Date().toISOString(), sms_consent_at: null }).eq('phone', req.body.From);
        if (error) throw error;
      }
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send('<Response/>');
    } catch { return res.status(503).end(); }
  };
}
export default createSmsEventsHandler();
