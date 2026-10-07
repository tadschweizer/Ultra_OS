import { loadMessagePage, parseMessageCursor, insertMessageOnce, validMessageId } from '../../../lib/directMessages.js';
import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { loadMessagingSummary, inboxConversations } from '../../../lib/messagingSummary.js';
import { getEffectiveAthleteIdFromRequest } from '../../../lib/auth/requireAthlete.js';
import { loadAccountAccess } from '../../../lib/auth/roleAccessServer.js';
import { resolveAccountMode } from '../../../lib/auth/roleGuards.js';

const MESSAGE_TEMPLATES = {
  missed_protocol_reminder: 'Quick check-in: I noticed a missed protocol session. Can you share what got in the way and your plan for the next session?',
  race_week_checkin: 'Race-week check-in: how is energy, sleep, and confidence today? Any adjustments needed?',
  gut_training_reminder: 'Reminder: keep gut training consistent this week. Log your intake and any symptoms after key sessions.',
  heat_block_reminder: 'Heat block reminder: prioritize hydration + sodium and log RPE/HR drift after sessions.',
  post_race_debrief_prompt: 'Great effort. When you can, send your post-race debrief: what went well, what to improve, and how recovery is going.',
  general_checkin: 'General check-in: how are you feeling this week and where do you need support?'
};

export function createMessagesHandler({ getAdmin = getSupabaseAdminClient, getActor = getEffectiveAthleteIdFromRequest } = {}) {
  return async function handler(req, res) {
    const supabase = getAdmin();
    res.setHeader('Cache-Control', 'private, no-store');
    const actorId = await getActor(req, supabase);
    if (!actorId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const access = await loadAccountAccess(supabase, actorId);
      const requestedMode = req.method === 'GET' ? req.query.mode : req.body?.mode;
      // This route is the explicit coaching message flow for coach-capable
      // accounts. Athlete mode remains available for a coach who is also coached.
      const messageMode = resolveAccountMode(
        access,
        requestedMode || (access?.capabilities?.coach ? 'coach' : 'athlete')
      );
      const coachProfile = messageMode === 'coach' && access?.capabilities.coach
        ? access.coachProfile
        : null;
      if (req.method === 'GET') {
        try { parseMessageCursor(req.query.before); } catch { return res.status(400).json({ error: 'Invalid message cursor.' }); }
        const requestedAthleteId = req.query.athlete_id || '';

        if (coachProfile?.id) {
          if (!requestedAthleteId) {
            const conversations = inboxConversations(await loadMessagingSummary(supabase, actorId, 'coach'));
            return res.status(200).json({ messages: [], conversations, templates: MESSAGE_TEMPLATES, role: 'coach', actor_id: actorId });
          }

          const { data: relationship, error: relationshipError } = await supabase
            .from('coach_athlete_relationships')
            .select('id')
            .eq('coach_id', coachProfile.id)
            .eq('athlete_id', requestedAthleteId)
            .eq('status', 'active')
            .maybeSingle();
          if (relationshipError) throw relationshipError;
          if (!relationship) return res.status(403).json({ error: 'No active coaching relationship with this athlete.' });

          const page = await loadMessagePage(supabase, coachProfile.id, requestedAthleteId, req.query.before);
          const conversations = inboxConversations(await loadMessagingSummary(supabase, actorId, 'coach'));
          return res.status(200).json({ ...page, conversations, templates: MESSAGE_TEMPLATES, role: 'coach', actor_id: actorId });
        }

        const { data: rel, error: relationError } = await supabase.from('coach_athlete_relationships').select('coach_id').eq('athlete_id', actorId).eq('status', 'active').order('coach_id', { ascending: true }).limit(1).maybeSingle();
        if (relationError) throw relationError;
        if (!rel?.coach_id) return res.status(200).json({ messages: [], conversations: [], templates: MESSAGE_TEMPLATES, role: 'athlete', actor_id: actorId });

        const page = await loadMessagePage(supabase, rel.coach_id, actorId, req.query.before);
        const conversations = inboxConversations(await loadMessagingSummary(supabase, actorId, 'athlete'));
        return res.status(200).json({ ...page, conversations, templates: MESSAGE_TEMPLATES, role: 'athlete', actor_id: actorId });
      }

      if (req.method === 'POST') {
        const body = req.body || {};
        if (body.client_message_id != null && !validMessageId(body.client_message_id)) return res.status(400).json({ error: 'Invalid message retry key.' });
        if (body.message_body != null && (typeof body.message_body !== 'string' || body.message_body.length > 5000)) return res.status(400).json({ error: 'Messages must be 5,000 characters or fewer.' });
        if (coachProfile?.id) {
          if (!body.athlete_id) return res.status(400).json({ error: 'athlete_id is required' });
          const { data: relationship, error: relationshipError } = await supabase
            .from('coach_athlete_relationships')
            .select('id')
            .eq('coach_id', coachProfile.id)
            .eq('athlete_id', body.athlete_id)
            .eq('status', 'active')
            .maybeSingle();
          if (relationshipError) throw relationshipError;
          if (!relationship) return res.status(403).json({ error: 'No active coaching relationship with this athlete.' });

          const text = (body.message_body || MESSAGE_TEMPLATES[body.template_key] || '').trim();
          if (!text) return res.status(400).json({ error: 'message_body is required' });
          const { data, error } = await insertMessageOnce(supabase, { coach_id: coachProfile.id, athlete_id: body.athlete_id, sender_role: 'coach', message_body: text, message_template_key: body.template_key || null }, body.client_message_id);
          if (error) return res.status(500).json({ error: 'Messages are unavailable. Please try again.' });
          return res.status(200).json({ message: data });
        }

        const { data: rel, error: relationError } = await supabase.from('coach_athlete_relationships').select('coach_id').eq('athlete_id', actorId).eq('status', 'active').order('coach_id', { ascending: true }).limit(1).maybeSingle();
        if (relationError) throw relationError;
        const coachId = rel?.coach_id;
        if (!coachId) return res.status(403).json({ error: 'No active coach relationship' });
        if (!body.message_body?.trim()) return res.status(400).json({ error: 'message_body is required' });
        const text = body.message_body.trim();
        const { data, error } = await insertMessageOnce(supabase, { coach_id: coachId, athlete_id: actorId, sender_role: 'athlete', message_body: text }, body.client_message_id);
        if (error) return res.status(500).json({ error: 'Messages are unavailable. Please try again.' });
        return res.status(200).json({ message: data });
      }

      res.status(405).end();
    } catch (error) {
      res.status(500).json({ error: 'Messages are unavailable. Please try again.' });
    }
  }
}
export default createMessagesHandler();
