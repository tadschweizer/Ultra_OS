import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { getEffectiveAthleteIdFromRequest } from '../../lib/auth/requireAthlete.js';
import { parseMessageCursor, validMessageId } from '../../lib/directMessages.js';
import { DEFAULT_NOTIFICATIONS, sanitizePreferences } from '../../lib/notificationPreferences.js';

export function createNotificationsHandler({ getAdmin = getSupabaseAdminClient, getActor = getEffectiveAthleteIdFromRequest } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    const admin = getAdmin();
    const actorId = await getActor(req, admin);
    if (!actorId) return res.status(401).json({ error: 'Not authenticated' });
    try {
      if (req.method === 'GET') {
        let cursor;
        try { cursor = parseMessageCursor(req.query.before); }
        catch { return res.status(400).json({ error: 'Invalid notification cursor.' }); }
        const [preferences, feed] = await Promise.all([
          admin.from('athletes').select('notification_preferences').eq('id', actorId).single(),
          admin.rpc('notification_feed', { p_actor_id: actorId, p_before_time: cursor?.time || null, p_before_id: cursor?.id || null }),
        ]);
        if (preferences.error || feed.error || !feed.data) throw preferences.error || feed.error || new Error('No feed');
        return res.status(200).json({ actor_id: actorId, preferences: { ...DEFAULT_NOTIFICATIONS, ...preferences.data?.notification_preferences }, ...feed.data });
      }
      if (req.method === 'PATCH') {
        if (req.body?.mark_read) {
          const ids = req.body.notification_ids;
          if (!Array.isArray(ids) || !ids.length || ids.length > 50 || !ids.every(validMessageId)) {
            return res.status(400).json({ error: 'Provide the notifications you have read.' });
          }
          const { error } = await admin.from('account_notifications').update({ read_at: new Date().toISOString() })
            .eq('recipient_id', actorId).in('id', ids).eq('delivery_state', 'delivered').is('read_at', null);
          if (error) throw error;
          return res.status(200).json({ success: true });
        }
        const patch = sanitizePreferences(req.body?.preferences);
        if (!patch) return res.status(400).json({ error: 'Use known notification preferences with true or false values.' });
        const { data, error } = await admin.rpc('patch_notification_preferences', { p_actor_id: actorId, p_patch: patch });
        if (error || !data) throw error || new Error('Account missing');
        return res.status(200).json({ preferences: { ...DEFAULT_NOTIFICATIONS, ...data } });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch {
      return res.status(500).json({ error: 'Notifications are unavailable. Please try again.' });
    }
  };
}
export default createNotificationsHandler();
