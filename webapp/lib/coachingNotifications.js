export const COACHING_EVENTS = [
  { key: 'workout_completed', label: 'An athlete uploads or completes a workout' },
  { key: 'workout_comment', label: 'A coach or athlete comments on a workout' },
  { key: 'workout_assigned', label: 'My coach assigns a new workout' },
];

export const EMPTY_COACHING_PREFERENCES = Object.fromEntries(
  COACHING_EVENTS.flatMap(({ key }) => ['email', 'sms'].map(channel => [`${key}_${channel}`, false]))
);

export function validateCoachingPreferences(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const entries = Object.entries(value);
  if (!entries.length || entries.some(([key, enabled]) => !Object.hasOwn(EMPTY_COACHING_PREFERENCES, key) || typeof enabled !== 'boolean')) return null;
  return Object.fromEntries(entries);
}

export function coachingAvailability(env = process.env) {
  const worker = env.COACHING_NOTIFICATIONS_ENABLED === 'true' && env.COACHING_NOTIFICATION_WORKER_SECRET?.length >= 32;
  return {
    email: Boolean(worker && env.RESEND_API_KEY),
    sms: Boolean(worker && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_MESSAGING_SERVICE_SID && env.TWILIO_VERIFY_SERVICE_SID && env.TWILIO_INBOUND_WEBHOOK_URL?.startsWith('https://')),
  };
}

export function notificationText(event) {
  return {
    workout_completed: 'An athlete has uploaded or completed a workout.',
    workout_comment: 'You have a new workout comment.',
    workout_assigned: 'Your coach has assigned a new workout.',
  }[event] || 'You have a training update.';
}
