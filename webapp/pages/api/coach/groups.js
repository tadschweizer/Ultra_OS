import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase.from('athletes').select('id, name').eq('id', athleteId).single();
  const { data: existing } = await supabase.from('coach_profiles').select('id, athlete_id').eq('athlete_id', athleteId).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from('coach_profiles').insert({ athlete_id: athleteId, display_name: athlete?.name || 'Coach', coach_code: generateCoachCode(athlete?.name || 'Coach') }).select('id, athlete_id').single();
  if (error) throw error;
  return data;
}

function getAthleteId(req) { return cookie.parse(req.headers.cookie || '').athlete_id; }

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) return res.status(401).json({ error: 'Not authenticated' });
  const profile = await ensureCoachProfile(athleteId);

  if (req.method === 'GET') {
    const { data: groups, error } = await supabase.from('coach_groups').select('id, name, description, created_at, coach_group_members(athlete_id, athletes(id, name, email))').eq('coach_id', profile.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ groups: groups || [] });
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { data, error } = await supabase.from('coach_groups').insert({ coach_id: profile.id, name: body.name.trim(), description: body.description?.trim() || null }).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ group: data });
  }
  if (req.method === 'PUT') {
    const body = req.body || {};
    if (!body.group_id) return res.status(400).json({ error: 'group_id is required' });
    if (body.athlete_id) {
      if (body.action === 'remove') {
        const { error } = await supabase.from('coach_group_members').delete().eq('group_id', body.group_id).eq('athlete_id', body.athlete_id);
        if (error) return res.status(500).json({ error: error.message });
      } else {
        const { error } = await supabase.from('coach_group_members').upsert({ group_id: body.group_id, athlete_id: body.athlete_id });
        if (error) return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    }
    const { data, error } = await supabase.from('coach_groups').update({ name: body.name, description: body.description }).eq('id', body.group_id).eq('coach_id', profile.id).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ group: data });
  }
  res.status(405).end();
}
