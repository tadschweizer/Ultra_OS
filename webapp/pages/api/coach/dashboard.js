import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';
import { buildLoadMetrics } from '../../../lib/loadRollups';

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

    const { data: activeLinks } = await supabase
      .from('coach_athlete_relationships')
      .select('athlete_id')
      .eq('coach_id', profile.id)
      .eq('status', 'active');

    const athleteIds = (activeLinks || []).map((item) => item.athlete_id);
    let loadSummary = { acute: 0, chronic: 0, form: 0 };
    if (athleteIds.length) {
      const [interventionsRes, activitiesRes] = await Promise.all([
        supabase
          .from('interventions')
          .select('athlete_id, date, inserted_at, dose_duration, subjective_feel')
          .in('athlete_id', athleteIds)
          .gte('inserted_at', new Date(Date.now() - 42 * 86400000).toISOString()),
        supabase
          .from('activities')
          .select('athlete_id, start_date, moving_time, perceived_exertion')
          .in('athlete_id', athleteIds)
          .gte('start_date', new Date(Date.now() - 42 * 86400000).toISOString()),
      ]);
      const metrics = athleteIds.map((athleteId) => buildLoadMetrics({
        interventions: (interventionsRes.data || []).filter((item) => item.athlete_id === athleteId),
        activities: (activitiesRes.data || []).filter((item) => item.athlete_id === athleteId),
        lookbackDays: 42,
      }));
      const divisor = Math.max(metrics.length, 1);
      loadSummary = {
        acute: Number((metrics.reduce((sum, item) => sum + item.acute, 0) / divisor).toFixed(1)),
        chronic: Number((metrics.reduce((sum, item) => sum + item.chronic, 0) / divisor).toFixed(1)),
        form: Number((metrics.reduce((sum, item) => sum + item.form, 0) / divisor).toFixed(1)),
      };
    }

    res.status(200).json({ summary, profile, loadSummary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
