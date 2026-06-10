import { getSupabaseAdminClient } from '../../../../lib/authServer';

// COROS sends a shared secret in the Authorization header as "Bearer <secret>"
// to verify requests are genuinely from COROS.
const COROS_WEBHOOK_SECRET = process.env.COROS_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify shared secret when configured
  if (COROS_WEBHOOK_SECRET) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token !== COROS_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const payload = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Empty payload' });
  }

  // COROS Workout Summary Data Push payload shape (section 5.3):
  // { userId, sportType, openId, sportName, workoutId, startTime, endTime, ... }
  const openId = payload.openId || payload.userId;

  const admin = getSupabaseAdminClient();

  // Look up the athlete by coros_open_id
  let athleteId = null;
  if (openId) {
    const { data: athlete } = await admin
      .from('athletes')
      .select('id')
      .eq('coros_open_id', openId)
      .maybeSingle();
    if (athlete) athleteId = athlete.id;
  }

  const { error } = await admin.from('coros_activities').insert({
    athlete_id: athleteId,
    coros_open_id: openId || null,
    workout_id: payload.workoutId || payload.sportData?.workoutId || null,
    sport_type: payload.sportType ?? null,
    sport_name: payload.sportName || null,
    start_time: payload.startTime ? new Date(payload.startTime * 1000).toISOString() : null,
    end_time: payload.endTime ? new Date(payload.endTime * 1000).toISOString() : null,
    raw_payload: payload,
  });

  if (error) {
    console.error('[coros/activities webhook] insert error', error);
    return res.status(500).json({ error: 'Failed to store activity' });
  }

  return res.status(200).json({ received: true });
}
