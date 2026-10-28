import { notificationText } from './coachingNotifications.js';
import { getSiteUrl, sendCoachingNotificationEmail } from './email/transactional.js';

export async function twilioRequest(path, fields, { verify = false, fetcher = fetch, env = process.env } = {}) {
  const url = verify ? `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`
    : `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/${path}.json`;
  try {
    const response = await fetcher(url, { method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, body, outcome: response.ok ? 'accepted' : response.status === 429 ? 'retry' : response.status >= 500 ? 'uncertain' : 'failed' };
  } catch { return { ok: false, outcome: 'uncertain', body: {} }; }
}

export async function deliverCoachingNotification(job) {
  if (job.channel === 'email') {
    const result = await sendCoachingNotificationEmail(job);
    return { outcome: result.ok && !result.skipped ? 'accepted' : result.failureCategory === 'provider_rejected' ? 'failed' : 'retry', providerId: result.providerId };
  }
  const path = job.mode === 'coach' ? `/coach/athletes/${encodeURIComponent(job.athlete_id)}` : '/calendar';
  const result = await twilioRequest('Messages', {
    To: job.phone, MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    Body: `Threshold: ${notificationText(job.event)} ${getSiteUrl()}${path} Reply STOP to stop.`,
  });
  return { outcome: result.outcome, providerId: result.body.sid || null, stopped: result.body.code === 21610 };
}
