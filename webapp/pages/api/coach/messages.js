import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';

function getAthleteId(req) { return cookie.parse(req.headers.cookie || '').athlete_id; }

const MESSAGE_TEMPLATES = {
  missed_protocol_reminder: 'Quick check-in: I noticed a missed protocol session. Can you share what got in the way and your plan for the next session?',
  race_week_checkin: 'Race-week check-in: how is energy, sleep, and confidence today? Any adjustments needed?',
  gut_training_reminder: 'Reminder: keep gut training consistent this week. Log your intake and any symptoms after key sessions.',
  heat_block_reminder: 'Heat block reminder: prioritize hydration + sodium and log RPE/HR drift after sessions.',
  post_race_debrief_prompt: 'Great effort. When you can, send your post-race debrief: what went well, what to improve, and how recovery is going.',
  general_checkin: 'General check-in: how are you feeling this week and where do you need support?'
};

function latestByAthlete(messages = []) {
  const map = new Map();
  messages.forEach((message) => {
    const current = map.get(message.athlete_id);
    if (!current || new Date(message.created_at) > new Date(current.created_at)) {
      map.set(message.athlete_id, message);
    }
  });
  return map;
}

async function getCoachProfile(actorId) {
  const { data } = await supabase.from('coach_profiles').select('id').eq('athlete_id', actorId).maybeSingle();
  return data || null;
}

async function getActiveCoachRelationship(actorId) {
  const { data } = await supabase
    .from('coach_athlete_relationships')
    .select('coach_id')
    .eq('athlete_id', actorId)
    .eq('status', 'active')
    .limit(1);
  return data?.[0] || null;
}

async function buildCoachConversations(coachId) {
  const { data: relationships, error: relationshipError } = await supabase
    .from('coach_athlete_relationships')
    .select('athlete_id, status, group_name, created_at')
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (relationshipError) throw relationshipError;

  const athleteIds = (relationships || []).map((rel) => rel.athlete_id);
  if (!athleteIds.length) return [];

  const { data: athletes, error: athleteError } = await supabase
    .from('athletes')
    .select('id, name, email')
    .in('id', athleteIds);
  if (athleteError) throw athleteError;

  const { data: messages, error: messageError } = await supabase
    .from('coach_messages')
    .select('*')
    .eq('coach_id', coachId)
    .in('athlete_id', athleteIds)
    .order('created_at', { ascending: false });
  if (messageError) throw messageError;

  const latest = latestByAthlete(messages || []);
  return (relationships || []).map((rel) => {
    const lastMessage = latest.get(rel.athlete_id) || null;
    return {
      athlete_id: rel.athlete_id,
      athlete: (athletes || []).find((athlete) => athlete.id === rel.athlete_id) || null,
      group_name: rel.group_name || null,
      last_message: lastMessage,
      unread_count: (messages || []).filter((m) => m.athlete_id === rel.athlete_id && m.sender_role === 'athlete' && !m.read_at).length,
    };
  }).sort((a, b) => new Date(b.last_message?.created_at || 0) - new Date(a.last_message?.created_at || 0));
}

async function buildAthleteConversation(actorId, coachId) {
  const { data: coach } = await supabase
    .from('coach_profiles')
    .select('id, display_name')
    .eq('id', coachId)
    .maybeSingle();
  const { data: messages, error } = await supabase
    .from('coach_messages')
    .select('*')
    .eq('coach_id', coachId)
    .eq('athlete_id', actorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return [{
    athlete_id: actorId,
    athlete: { id: actorId, name: coach?.display_name || 'Coach' },
    group_name: null,
    last_message: messages?.[0] || null,
    unread_count: (messages || []).filter((m) => m.sender_role === 'coach' && !m.read_at).length,
  }];
}

export default async function handler(req, res) {
  const actorId = getAthleteId(req);
  if (!actorId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      const requestedAthleteId = req.query.athlete_id || '';
      const coachProfile = await getCoachProfile(actorId);

      if (coachProfile?.id) {
        if (!requestedAthleteId) {
          const conversations = await buildCoachConversations(coachProfile.id);
          return res.status(200).json({ messages: [], conversations, templates: MESSAGE_TEMPLATES, role: 'coach' });
        }

        const { data: relationship } = await supabase
          .from('coach_athlete_relationships')
          .select('id')
          .eq('coach_id', coachProfile.id)
          .eq('athlete_id', requestedAthleteId)
          .eq('status', 'active')
          .maybeSingle();
        if (!relationship) return res.status(403).json({ error: 'No active coaching relationship with this athlete.' });

        const { data, error } = await supabase
          .from('coach_messages')
          .select('*')
          .eq('coach_id', coachProfile.id)
          .eq('athlete_id', requestedAthleteId)
          .order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        const conversations = await buildCoachConversations(coachProfile.id);
        return res.status(200).json({ messages: data || [], conversations, templates: MESSAGE_TEMPLATES, role: 'coach' });
      }

      const rel = await getActiveCoachRelationship(actorId);
      if (!rel?.coach_id) return res.status(200).json({ messages: [], conversations: [], templates: MESSAGE_TEMPLATES, role: 'athlete' });

      const { data, error } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('coach_id', rel.coach_id)
        .eq('athlete_id', actorId)
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      const conversations = await buildAthleteConversation(actorId, rel.coach_id);
      return res.status(200).json({ messages: data || [], conversations, templates: MESSAGE_TEMPLATES, role: 'athlete' });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const coachProfile = await getCoachProfile(actorId);
      if (coachProfile?.id) {
        if (!body.athlete_id) return res.status(400).json({ error: 'athlete_id is required' });
        const { data: relationship } = await supabase
          .from('coach_athlete_relationships')
          .select('id')
          .eq('coach_id', coachProfile.id)
          .eq('athlete_id', body.athlete_id)
          .eq('status', 'active')
          .maybeSingle();
        if (!relationship) return res.status(403).json({ error: 'No active coaching relationship with this athlete.' });

        const text = (body.message_body || MESSAGE_TEMPLATES[body.template_key] || '').trim();
        if (!text) return res.status(400).json({ error: 'message_body is required' });
        const { data, error } = await supabase.from('coach_messages').insert({ coach_id: coachProfile.id, athlete_id: body.athlete_id, sender_role: 'coach', message_body: text, message_template_key: body.template_key || null }).select('*').single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ message: data });
      }

      const rel = await getActiveCoachRelationship(actorId);
      const coachId = rel?.coach_id;
      if (!coachId) return res.status(403).json({ error: 'No active coach relationship' });
      if (!body.message_body?.trim()) return res.status(400).json({ error: 'message_body is required' });
      const text = body.message_body.trim();
      const { data, error } = await supabase.from('coach_messages').insert({ coach_id: coachId, athlete_id: actorId, sender_role: 'athlete', message_body: text }).select('*').single();
      if (error) return res.status(500).json({ error: error.message });
      await supabase.from('coach_notifications').insert({
        coach_id: coachId,
        athlete_id: actorId,
        notification_type: 'athlete_message',
        title: 'New athlete message',
        body: text.slice(0, 240),
        entity_type: 'coach_message',
        entity_id: data.id,
      });
      return res.status(200).json({ message: data });
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
