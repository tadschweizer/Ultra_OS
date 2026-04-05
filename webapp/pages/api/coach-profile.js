import cookie from 'cookie';
import { supabase } from '../../lib/supabaseClient';
import { generateCoachCode } from '../../lib/coachProtocols';

export const runtime = 'edge';

function getAthleteId(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return cookies.athlete_id;
}

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();

  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code, created_at')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) return existing;

  const payload = {
    athlete_id: athleteId,
    display_name: athlete?.name || 'Coach',
    coach_code: generateCoachCode(athlete?.name || 'Coach'),
  };

  const { data, error } = await supabase
    .from('coach_profiles')
    .insert(payload)
    .select('id, athlete_id, display_name, coach_code, created_at')
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const profile = await ensureCoachProfile(athleteId);
    res.status(200).json({ profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
