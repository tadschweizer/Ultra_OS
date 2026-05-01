import cookie from 'cookie';
import { supabase } from '../../lib/supabaseClient';

const DEFAULT_NOTIFICATIONS = {
  coach_note_reply: true,
  protocol_assignment_comment: true,
  workout_comment: true,
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
    const { data, error } = await supabase
      .from('athletes')
      .select('id, notification_preferences')
      .eq('id', athleteId)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ preferences: { ...DEFAULT_NOTIFICATIONS, ...(data?.notification_preferences || {}) } });
  }

  if (req.method === 'PATCH') {
    const incoming = req.body?.preferences || {};
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
