export const DEFAULT_NOTIFICATIONS = {
  coach_message: true, coach_note_reply: true, protocol_assignment_comment: true,
  workout_comment: true, athlete_message: true, compliance_miss_alert: true,
  hrv_trend_alert: true, sleep_dip_alert: true,
};

export function sanitizePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (!entries.length || entries.some(([key, enabled]) => !Object.hasOwn(DEFAULT_NOTIFICATIONS, key) || typeof enabled !== 'boolean')) return null;
  return Object.fromEntries(entries);
}

export function notificationLink(notification, actorId) {
  const mode = notification.athlete_id === actorId ? 'athlete' : 'coach';
  if (notification.entity_type === 'coach_message') return `/messages?mode=${mode}&athlete_id=${encodeURIComponent(notification.athlete_id)}`;
  if (['planned_workout', 'activity'].includes(notification.entity_type)) {
    const subject = notification.entity_type === 'activity' ? 'activity' : 'workout';
    return mode === 'coach'
      ? `/coach/training-calendar?athlete=${encodeURIComponent(notification.athlete_id)}&${subject}=${encodeURIComponent(notification.entity_id)}`
      : `/calendar?${subject}=${encodeURIComponent(notification.entity_id)}`;
  }
  return null;
}
