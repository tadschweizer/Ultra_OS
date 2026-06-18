import cookie from 'cookie';
import { supabase } from '../../lib/supabaseClient';

const DEFAULT_NOTIFICATIONS = {
  coach_note_reply: true,
  protocol_assignment_comment: true,
  workout_comment: true,
  athlete_message: true,
  compliance_miss_alert: true,
  hrv_trend_alert: true,
  sleep_dip_alert: true,
};

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('athlete_id', athleteId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('athletes')
      .select('id, notification_preferences')
      .eq('id', athleteId)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    let coachNotifications = [];
    if (coachProfile?.id) {
      const { data: notifications, error: notificationError } = await supabase
        .from('coach_notifications')
        .select('id, athlete_id, notification_type, title, body, entity_type, entity_id, read_at, created_at')
        .eq('coach_id', coachProfile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (notificationError) return res.status(500).json({ error: notificationError.message });
      coachNotifications = notifications || [];
    }

    return res.status(200).json({
      preferences: { ...DEFAULT_NOTIFICATIONS, ...(data?.notification_preferences || {}) },
      coachNotifications,
      unreadCoachNotifications: coachNotifications.filter((n) => !n.read_at).length,
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};

    if (body.mark_read) {
      const { data: coachProfile } = await supabase
        .from('coach_profiles')
        .select('id')
        .eq('athlete_id', athleteId)
        .maybeSingle();
      if (!coachProfile?.id) return res.status(403).json({ error: 'Coach notifications require a coach profile.' });

      let query = supabase
        .from('coach_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('coach_id', coachProfile.id);
      if (body.notification_id) query = query.eq('id', body.notification_id);
      const { error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    const incoming = body.preferences || {};
    const sanitized = Object.fromEntries(
      Object.entries(incoming)
        .filter(([k]) => Object.prototype.hasOwnProperty.call(DEFAULT_NOTIFICATIONS, k))
        .map(([k, v]) => [k, Boolean(v)])
    );

    const { data: athlete, error: readError } = await supabase
      .from('athletes')
      .select('notification_preferences')
      .eq('id', athleteId)
      .single();

    if (readError) return res.status(500).json({ error: readError.message });

    const merged = { ...DEFAULT_NOTIFICATIONS, ...(athlete?.notification_preferences || {}), ...sanitized };

    const { error } = await supabase
      .from('athletes')
      .update({ notification_preferences: merged })
      .eq('id', athleteId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ preferences: merged });
  }

  return res.status(405).end();
}
