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

export default async function handler(req, res) {
  const actorId = getAthleteId(req);
  if (!actorId) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const athleteId = req.query.athlete_id || actorId;
    const { data: cp } = await supabase.from('coach_profiles').select('id').eq('athlete_id', actorId).maybeSingle();
    let query = supabase.from('coach_messages').select('*').order('created_at', { ascending: true });
    if (cp?.id) query = query.eq('coach_id', cp.id).eq('athlete_id', athleteId);
    else {
      const { data: rel } = await supabase.from('coach_athlete_relationships').select('coach_id').eq('athlete_id', actorId).eq('status', 'active').limit(1);
      const coachId = rel?.[0]?.coach_id;
      if (!coachId) return res.status(200).json({ messages: [], templates: MESSAGE_TEMPLATES });
      query = query.eq('coach_id', coachId).eq('athlete_id', actorId);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ messages: data || [], templates: MESSAGE_TEMPLATES });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { data: coachProfile } = await supabase.from('coach_profiles').select('id').eq('athlete_id', actorId).maybeSingle();
    if (coachProfile?.id) {
      if (!body.athlete_id) return res.status(400).json({ error: 'athlete_id is required' });
      const text = (body.message_body || MESSAGE_TEMPLATES[body.template_key] || '').trim();
      if (!text) return res.status(400).json({ error: 'message_body is required' });
      const { data, error } = await supabase.from('coach_messages').insert({ coach_id: coachProfile.id, athlete_id: body.athlete_id, sender_role: 'coach', message_body: text, message_template_key: body.template_key || null }).select('*').single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ message: data });
    }
    const { data: rel } = await supabase.from('coach_athlete_relationships').select('coach_id').eq('athlete_id', actorId).eq('status', 'active').limit(1);
    const coachId = rel?.[0]?.coach_id;
    if (!coachId) return res.status(403).json({ error: 'No active coach relationship' });
    if (!body.message_body?.trim()) return res.status(400).json({ error: 'message_body is required' });
    const { data, error } = await supabase.from('coach_messages').insert({ coach_id: coachId, athlete_id: actorId, sender_role: 'athlete', message_body: body.message_body.trim() }).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: data });
  }

  res.status(405).end();
}
