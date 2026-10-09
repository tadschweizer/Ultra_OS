import { loadAccountAccess } from './auth/roleAccessServer.js';
import { resolveAccountMode } from './auth/roleGuards.js';
import { resolveEffectiveAthleteId } from './auth/requireAthlete.js';

export async function messageActor(req, admin, { preferCoach = true } = {}) {
  const resolved = await resolveEffectiveAthleteId(req, admin);
  if (!resolved.athleteId) return null;
  const access = await loadAccountAccess(admin, resolved.athleteId);
  if (!access) return null;
  const requested = req.method === 'GET' ? req.query?.mode : req.body?.mode;
  return { id: resolved.athleteId, role: resolveAccountMode(access, requested || (preferCoach && access.capabilities.coach ? 'coach' : access.primaryRole)), access };
}

export async function messageConversation(admin, actor, requestedAthleteId) {
  const athleteId = actor.role === 'coach' ? requestedAthleteId : actor.id;
  if (!athleteId) return null;
  let query = admin.from('coach_athlete_relationships').select('coach_id, athlete_id')
    .eq('athlete_id', athleteId).eq('status', 'active');
  if (actor.role === 'coach') query = query.eq('coach_id', actor.access.coachProfile.id);
  const { data, error } = await query.order('created_at', { ascending: true }).order('id', { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function inboxSummary(admin, actor) {
  const { data, error } = await admin.rpc('message_inbox_summary', { p_owner: actor.id, p_role: actor.role });
  if (error || !data) throw error || new Error('Summary unavailable');
  return data;
}

export function messagingFailure(res, error) {
  if (error?.code === '42501') return res.status(403).json({ error: 'No active coaching relationship.' });
  if (['PT409','40001'].includes(error?.code)) return res.status(409).json({ error: 'This draft or message changed in another session. Review it before retrying.' });
  if (error?.code === '22023') return res.status(400).json({ error: 'Please review your message and try again.' });
  return res.status(503).json({ error: 'Messages are unavailable. Your draft has not been discarded. Please retry.' });
}
