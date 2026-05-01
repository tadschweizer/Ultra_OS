import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';

function buildRaceReadiness({ upcomingRace, activeProtocols, compliance, activities, checkins, interventions }) {
  const daysUntilRace = upcomingRace?.event_date ? Math.ceil((new Date(upcomingRace.event_date) - new Date()) / 86400000) : null;
  const daysUntilRaceLabel = daysUntilRace === null ? null : daysUntilRace < 0 ? `Race date passed (${Math.abs(daysUntilRace)}d ago)` : `${daysUntilRace} days`;

  const protocolSummary = activeProtocols.length
    ? activeProtocols.map((p) => p.protocol_name).slice(0, 3).join(', ')
    : null;

  const avgCompliance = compliance.length
    ? Math.round(compliance.reduce((acc, item) => acc + Number(item.actual || 0), 0) / compliance.length)
    : null;

  const domainRows = [
    { name: 'Heat', key: 'heat' },
    { name: 'Gut', key: 'gut' },
    { name: 'Fueling', key: 'fuel' },
    { name: 'Sleep', key: 'sleep' },
    { name: 'Recovery', key: 'recovery' },
  ];

  const domains = domainRows.map((row) => {
    const hits = interventions.filter((i) => String(i?.intervention_type || '').toLowerCase().includes(row.key)).length;
    if (!hits) return { name: row.name, status: 'Not enough data', note: 'No recent logs found.' };
    if (hits < 2) return { name: row.name, status: 'Early signal', note: `${hits} recent log${hits === 1 ? '' : 's'}; monitor response.` };
    return { name: row.name, status: 'On track', note: `${hits} recent logs recorded.` };
  });

  const signals = [];
  if (activities[0]) signals.push(`Latest workout: ${activities[0].name || activities[0].activity_type || 'Activity'} on ${String(activities[0].start_date || '').slice(0, 10)}.`);
  if (checkins[0]) signals.push(`Latest check-in readiness score: ${checkins[0].readiness_score ?? 'not entered'} (${String(checkins[0].created_at || '').slice(0, 10)}).`);
  if (checkins.length >= 3) {
    const avg = Math.round(checkins.slice(0, 3).reduce((a, c) => a + Number(c.readiness_score || 0), 0) / 3);
    signals.push(`3-check-in readiness average: ${avg}.`);
  }

  const missingData = [];
  if (!upcomingRace) missingData.push('Upcoming race date');
  if (!activeProtocols.length) missingData.push('Active protocol assignment');
  if (!checkins.length) missingData.push('Recent readiness check-ins');
  if (!activities.length) missingData.push('Recent workouts');
  if (!interventions.length) missingData.push('Recent protocol logs');

  const dataPoints = [upcomingRace, activeProtocols.length, compliance.length, activities.length, checkins.length, interventions.length].filter(Boolean).length;
  const confidence = dataPoints >= 5 ? 'high' : dataPoints >= 3 ? 'medium' : 'low';

  return {
    daysUntilRace,
    daysUntilRaceLabel,
    protocolSummary,
    complianceSummary: avgCompliance === null ? null : `${avgCompliance}% average vs assigned targets`,
    domains,
    signals,
    missingData,
    confidence,
    suggestedAction: missingData.length
      ? `Collect missing inputs first: ${missingData.slice(0, 2).join(', ')}.`
      : (avgCompliance !== null && avgCompliance < 70)
        ? "Review protocol barriers with the athlete and simplify this week's plan."
        : 'Stay with current progression and monitor check-ins for drift.',
  };
}


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
  const raceReadiness = buildRaceReadiness({ upcomingRace: (racesRes.data || [])[0] || null, activeProtocols, compliance, activities: activitiesRes.data || [], checkins, interventions });

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
    suggestedAction: riskLevel === 'red' ? 'Schedule a same-day check-in and adjust training load for the next 24-48 hours.' : riskLevel === 'yellow' ? 'Message the athlete to confirm protocol adherence and race-week constraints.' : 'Reinforce current plan and monitor for changes.',
    raceReadiness,
  });
}
