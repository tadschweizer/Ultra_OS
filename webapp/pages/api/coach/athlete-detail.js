import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';

export const runtime = 'edge';

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const authAthleteId = getAthleteId(req);
  const athleteId = req.query.athlete_id;
  if (!authAthleteId) return res.status(401).json({ error: 'Not authenticated' });
  if (!athleteId) return res.status(400).json({ error: 'athlete_id is required' });

  const { data: coachProfile } = await supabase.from('coach_profiles').select('id').eq('athlete_id', authAthleteId).maybeSingle();
  if (!coachProfile?.id) return res.status(403).json({ error: 'Coach profile not found' });

  const { data: relationship } = await supabase
    .from('coach_athlete_relationships')
    .select('id, status, group_name')
    .eq('coach_id', coachProfile.id)
    .eq('athlete_id', athleteId)
    .maybeSingle();
  if (!relationship) return res.status(404).json({ error: 'Athlete not found in your roster' });

  const [athleteRes, racesRes, protocolsRes, interventionsRes, activitiesRes, checkinsRes, notesRes] = await Promise.all([
    supabase.from('athletes').select('id, name, email, primary_sports').eq('id', athleteId).single(),
    supabase.from('races').select('id, name, event_date, race_type').eq('athlete_id', athleteId).gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(1),
    supabase.from('coach_protocol_assignments').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false }),
    supabase.from('interventions').select('*').eq('athlete_id', athleteId).order('inserted_at', { ascending: false }).limit(8),
    supabase.from('activities').select('*').eq('athlete_id', athleteId).order('start_date', { ascending: false }).limit(8),
    supabase.from('daily_checkins').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(8),
    supabase.from('coach_notes').select('*').eq('coach_id', coachProfile.id).eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(10),
  ]);

  const protocols = protocolsRes.data || [];
  const interventions = interventionsRes.data || [];
  const checkins = checkinsRes.data || [];
  const activeProtocols = protocols.filter((p) => ['assigned', 'in_progress', 'active'].includes(p.status));
  const compliance = activeProtocols.map((p) => ({
    id: p.id,
    protocol_name: p.protocol_name,
    target: p.compliance_target || 80,
    actual: Math.min(100, Math.round((interventions.length / Math.max(1, 7)) * 100)),
  }));
  const latestReadiness = checkins[0]?.readiness_score ?? null;
  const riskLevel = latestReadiness === null ? 'yellow' : latestReadiness < 45 ? 'red' : latestReadiness < 70 ? 'yellow' : 'green';

  res.status(200).json({
    athlete: athleteRes.data,
    relationship,
    upcomingRace: (racesRes.data || [])[0] || null,
    protocols,
    compliance,
    interventions,
    activities: activitiesRes.data || [],
    checkins,
    coachNotes: notesRes.data || [],
    riskLevel,
    suggestedAction: riskLevel === 'red' ? 'Call athlete today and reduce protocol load for 48h.' : riskLevel === 'yellow' ? 'Send check-in message and confirm protocol steps for this week.' : 'Reinforce plan and prepare next progression.',
  });
}
