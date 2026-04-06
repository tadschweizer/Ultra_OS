import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';

export const runtime = 'edge';

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();

  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('coach_profiles')
    .insert({
      athlete_id: athleteId,
      display_name: athlete?.name || 'Coach',
      coach_code: generateCoachCode(athlete?.name || 'Coach'),
    })
    .select('id, athlete_id, display_name, coach_code')
    .single();

  if (error) throw error;
  return data;
}

const emptySummary = {
  total_athletes: 0,
  active_protocols: 0,
  athletes_needing_attention: 0,
  upcoming_races: 0,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const athleteId = getAthleteId(req);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

    const { data, error } = await supabase.rpc('get_coach_dashboard_summary', {
      coach_uuid: profile.id,
    });

    if (error) { res.status(500).json({ error: error.message }); return; }

    const summary = (Array.isArray(data) ? data[0] : data) || emptySummary;
    res.status(200).json({ summary, profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
