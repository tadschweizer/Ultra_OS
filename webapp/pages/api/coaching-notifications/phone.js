import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { getAthleteIdFromRequestAsync } from '../../../lib/auth/requireAthlete.js';
import { getViewAsIdFromRequest } from '../../../lib/auth/sessionCookies.js';
import { getClientIp } from '../../../lib/auth/rateLimit.js';
import { requireSameOriginJson } from '../../../lib/billingSecurity.js';
import { coachingAvailability } from '../../../lib/coachingNotifications.js';
import { twilioRequest } from '../../../lib/coachingNotificationDelivery.js';

export function createNotificationPhoneHandler({ getClient = getSupabaseAdminClient, availability = coachingAvailability, verify = twilioRequest } = {}) {
  return async function handler(req, res) {
    if (!requireSameOriginJson(req, res)) return;
    try {
      const admin = getClient(), id = await getAthleteIdFromRequestAsync(req, admin);
      if (!id) return res.status(401).json({ error: 'Sign in to manage your phone.' });
      if (getViewAsIdFromRequest(req)) return res.status(403).json({ error: 'Exit account preview first.' });
      const { action, phone, code, consent } = req.body || {};
      if (action === 'remove') {
        const { error } = await admin.from('coaching_notification_settings').update({ phone: null, phone_verified_at: null, sms_consent_at: null,
          sms_stopped_at: new Date().toISOString() }).eq('athlete_id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
      if (!['start', 'check'].includes(action)) return res.status(400).json({ error: 'Choose a phone verification action.' });
      if (!availability().sms) return res.status(503).json({ error: 'Text notifications are not available yet.' });
      if (action === 'start' && (!/^\+[1-9]\d{7,14}$/.test(phone || '') || consent !== true)) {
        return res.status(400).json({ error: 'Enter a phone number with its country code and allow text notifications.' });
      }
      if (action === 'check' && !/^\d{4,10}$/.test(code || '')) return res.status(400).json({ error: 'Enter the code from your text message.' });
      // Durable reservations bound account, source IP, and destination. Fail closed.
      const buckets = [`account:${id}`, `ip:${getClientIp(req) || 'unknown'}`];
      if (action === 'start') buckets.push(`phone:${phone}`);
      for (const bucket of buckets) {
        const { data, error } = await admin.rpc('consume_auth_rate_limit', {
          p_key: crypto.createHash('sha256').update(`coaching-phone:${action}:${bucket}`).digest('hex'),
          p_limit: action === 'start' ? 3 : 10, p_window_seconds: 3600,
        });
        if (error) throw error;
        if (data !== true) return res.status(429).json({ error: 'Too many attempts. Please try again in an hour.' });
      }
      if (action === 'start') {
        const { error } = await admin.from('coaching_notification_settings').upsert({ athlete_id: id, phone, phone_verified_at: null,
          sms_consent_at: null, sms_stopped_at: null, updated_at: new Date().toISOString() });
        if (error) throw error;
        const result = await verify('Verifications', { To: phone, Channel: 'sms' }, { verify: true });
        if (!result.ok) return res.status(503).json({ error: 'We could not send a verification code. Please retry later.' });
        return res.status(200).json({ success: true });
      }
      const { data: settings, error } = await admin.from('coaching_notification_settings').select('phone').eq('athlete_id', id).single();
      if (error) throw error;
      if (!settings?.phone) return res.status(400).json({ error: 'Request a new verification code first.' });
      const result = await verify('VerificationCheck', { To: settings.phone, Code: code }, { verify: true });
      if (!result.ok || result.body.status !== 'approved' || result.body.to !== settings.phone) {
        return res.status(400).json({ error: 'That code could not be verified. Check it or request a new code.' });
      }
      const { data: saved, error: saveError } = await admin.from('coaching_notification_settings').update({
        phone_verified_at: new Date().toISOString(), sms_consent_at: new Date().toISOString(), sms_stopped_at: null,
      }).eq('athlete_id', id).eq('phone', settings.phone).select('athlete_id').maybeSingle();
      if (saveError) throw saveError;
      if (!saved) return res.status(409).json({ error: 'Your phone changed. Request a new code.' });
      return res.status(200).json({ success: true });
    } catch { return res.status(503).json({ error: 'Phone settings are unavailable. Please retry.' }); }
  };
}
export default createNotificationPhoneHandler();
