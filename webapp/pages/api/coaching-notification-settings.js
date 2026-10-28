import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { getAthleteIdFromRequestAsync } from '../../lib/auth/requireAthlete.js';
import { getViewAsIdFromRequest } from '../../lib/auth/sessionCookies.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';
import { coachingAvailability, EMPTY_COACHING_PREFERENCES, validateCoachingPreferences } from '../../lib/coachingNotifications.js';

export function createCoachingSettingsHandler({ getClient = getSupabaseAdminClient, availability = coachingAvailability, enabled = () => process.env.COACHING_NOTIFICATIONS_ENABLED === 'true' } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
    if (req.method === 'PATCH' && !requireSameOriginJson(req, res, 'PATCH')) return;
    try {
      const admin = getClient();
      const id = await getAthleteIdFromRequestAsync(req, admin);
      if (!id) return res.status(401).json({ error: 'Sign in to manage your notifications.' });
      if (getViewAsIdFromRequest(req)) return res.status(403).json({ error: 'Exit account preview to manage your own notifications.' });
      const { data: account, error: accountError } = await admin.from('athletes').select('email_verified_at').eq('id', id).single();
      if (accountError) throw accountError;
      const { data: stored, error } = await admin.from('coaching_notification_settings').select('*').eq('athlete_id', id).maybeSingle();
      const channels = availability();
      if (error) {
        // A disabled rollout may precede its migration. Only a missing table on
        // read is expected; never hide enabled-state, permission or transport errors.
        if (req.method === 'GET' && !enabled() && !channels.email && !channels.sms &&
          ['42P01', 'PGRST205'].includes(error.code)) {
          return res.status(200).json({ preferences: { ...EMPTY_COACHING_PREFERENCES }, available: channels,
            email_verified: Boolean(account?.email_verified_at), phone: null, phone_verified: false, sms_stopped: false });
        }
        throw error;
      }
      let preferences = { ...EMPTY_COACHING_PREFERENCES, ...stored?.preferences };
      if (req.method === 'PATCH') {
        const patch = validateCoachingPreferences(req.body?.preferences);
        if (!patch) return res.status(400).json({ error: 'Choose valid notification switches.' });
        if (Object.entries(patch).some(([key, enabled]) => enabled && !channels[key.endsWith('_sms') ? 'sms' : 'email'])) {
          return res.status(503).json({ error: 'That delivery channel is not available yet.' });
        }
        if (Object.entries(patch).some(([key, enabled]) => enabled && key.endsWith('_sms')) &&
          (!stored?.phone_verified_at || !stored?.sms_consent_at || stored?.sms_stopped_at)) {
          return res.status(400).json({ error: 'Verify your phone and allow text notifications first.' });
        }
        // Merge inside PostgreSQL so changes from two tabs cannot overwrite each other.
        const { data, error: saveError } = await admin.rpc('save_coaching_notification_preferences', { p_owner: id, p_patch: patch });
        if (saveError) throw saveError;
        preferences = { ...EMPTY_COACHING_PREFERENCES, ...data };
      }
      return res.status(200).json({ preferences, available: channels, email_verified: Boolean(account?.email_verified_at),
        phone: stored?.phone ? `•••• ${stored.phone.slice(-4)}` : null,
        phone_verified: Boolean(stored?.phone_verified_at), sms_stopped: Boolean(stored?.sms_stopped_at) });
    } catch {
      return res.status(503).json({ error: 'Notification settings are unavailable. Please retry.' });
    }
  };
}
export default createCoachingSettingsHandler();
