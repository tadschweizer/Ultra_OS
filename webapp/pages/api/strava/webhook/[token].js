import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../../../../lib/authServer.js';

const sameSecret = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const actual = Buffer.from(a), expected = Buffer.from(b);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};
const id = value => (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
  || (typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value));

// Strava does not sign POST bodies. The registered callback has a random,
// server-only path secret, and must also match the configured subscription ID.
// Never log the callback URL. Provider network calls are outside this fast handler.
export function createStravaWebhookHandler({ getClient = getSupabaseAdminClient,
  env = () => process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const config = env();
    if (!config.STRAVA_WEBHOOK_CALLBACK_SECRET || config.STRAVA_WEBHOOK_CALLBACK_SECRET.length < 32) {
      return res.status(503).json({ error: 'Webhook unavailable.' });
    }
    if (!sameSecret(req.query?.token, config.STRAVA_WEBHOOK_CALLBACK_SECRET)) return res.status(404).json({ error: 'Not found.' });
    if (req.method === 'GET') {
      if (req.query['hub.mode'] !== 'subscribe' || !sameSecret(req.query['hub.verify_token'], config.STRAVA_WEBHOOK_VERIFY_TOKEN)
        || typeof req.query['hub.challenge'] !== 'string' || req.query['hub.challenge'].length > 200) {
        return res.status(403).json({ error: 'Invalid verification.' });
      }
      return res.status(200).json({ 'hub.challenge': req.query['hub.challenge'] });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
    const event = req.body;
    if (!id(config.STRAVA_WEBHOOK_SUBSCRIPTION_ID)) return res.status(503).json({ error: 'Webhook unavailable.' });
    if (!event || !id(event.subscription_id) || String(event.subscription_id) !== config.STRAVA_WEBHOOK_SUBSCRIPTION_ID) {
      return res.status(403).json({ error: 'Invalid subscription.' });
    }
    if (!id(event.owner_id) || !id(event.object_id) || !Number.isSafeInteger(event.event_time)
      || event.event_time <= 0 || !['activity', 'athlete'].includes(event.object_type)
      || !['create', 'update', 'delete'].includes(event.aspect_type)
      || (event.object_type === 'athlete' && String(event.object_id) !== String(event.owner_id))) {
      return res.status(400).json({ error: 'Invalid event.' });
    }
    const deauthorized = event.object_type === 'athlete' && (event.updates?.authorized === 'false' || event.updates?.authorized === false);
    if (event.object_type === 'athlete' && !deauthorized) return res.status(200).json({ received: true });
    try {
      const { error } = await getClient().rpc('handle_strava_event', {
        p_owner_id: String(event.owner_id), p_activity_id: String(event.object_id),
        p_action: deauthorized ? 'deauthorize' : event.aspect_type === 'delete' ? 'delete' : 'refresh',
      });
      if (error) throw error;
      return res.status(200).json({ received: true });
    } catch { return res.status(503).json({ error: 'Event could not be saved. Retry delivery.' }); }
  };
}
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
export default createStravaWebhookHandler();
