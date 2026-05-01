import cookie from 'cookie';
import { supabase } from '../../lib/supabaseClient';
import {
  buildAssignmentStatusLabel,
  computePhaseFromDays,
  countAssignmentCompletions,
  getDaysUntil,
  normalizeRace,
} from '../../lib/coachProtocols';

function getAthleteId(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return cookies.athlete_id;
}

function selectCurrentRace(races = []) {
  const upcoming = races
    .filter((race) => race.event_date)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .find((race) => getDaysUntil(race.event_date) >= 0);

  if (upcoming) return upcoming;
  return races[0] || null;
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

  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('target_race_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (athleteError) {
    res.status(500).json({ error: athleteError.message });
    return;
  }

  const { data: races, error: raceError } = await supabase
    .from('races')
    .select('id, name, event_date, race_type, distance_miles, elevation_gain_ft, location, surface, notes')
    .eq('athlete_id', athleteId)
    .order('event_date', { ascending: true, nullsFirst: false });

  if (raceError) {
    res.status(500).json({ error: raceError.message });
    return;
  }

  const normalizedRaces = (races || []).map(normalizeRace);
  const athleteTargetRace = athlete?.target_race_id
    ? normalizedRaces.find((race) => race.id === athlete.target_race_id) || null
    : null;
  const baseRace = athleteTargetRace || selectCurrentRace(normalizedRaces);

  const { data: activeAssignments, error: assignmentError } = await supabase
    .from('coach_protocol_assignments')
    .select('id, athlete_id, coach_id, target_race_id, intervention_type, start_date, target_completion_date, frequency_type, frequency_details, planned_sessions, note, status, created_at, updated_at')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (assignmentError) {
    res.status(500).json({ error: assignmentError.message });
    return;
  }

  const { data: interventions, error: interventionError } = await supabase
    .from('interventions')
    .select('id, athlete_id, date, inserted_at, intervention_type, training_phase, target_race, race_id, races(id, name)')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });

  if (interventionError) {
    res.status(500).json({ error: interventionError.message });
    return;
  }

  const activeAssignment = activeAssignments?.[0] || null;
  const assignmentRace =
    activeAssignment?.target_race_id
      ? normalizedRaces.find((race) => race.id === activeAssignment.target_race_id) || null
      : null;
  const currentRace = assignmentRace || baseRace;
  const daysUntilRace = getDaysUntil(currentRace?.event_date);

  const relevantInterventions = currentRace
    ? (interventions || []).filter(
        (item) => item.race_id === currentRace.id || item.races?.id === currentRace.id || item.target_race === currentRace.name
      )
    : interventions || [];

  const latestPhase = relevantInterventions.find((item) => item.training_phase)?.training_phase || '';
  const phase = latestPhase || computePhaseFromDays(daysUntilRace);

  const completionCount = countAssignmentCompletions(activeAssignment, interventions || []);
  const fallbackCounts = relevantInterventions.reduce((accumulator, item) => {
    const key = item.intervention_type || 'Protocol';
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
  const [fallbackType, fallbackCount] = Object.entries(fallbackCounts).sort((a, b) => b[1] - a[1])[0] || [];
  const protocolStatus = activeAssignment
    ? buildAssignmentStatusLabel(activeAssignment, completionCount)
    : fallbackType
      ? `${fallbackType}: ${fallbackCount} session${fallbackCount === 1 ? '' : 's'} logged`
      : 'No active protocols — log your first intervention';

  res.status(200).json({
    currentRace,
    activeAssignment: activeAssignment
      ? {
          ...activeAssignment,
          completion_count: completionCount,
        }
      : null,
    phase,
    daysUntilRace,
    protocolStatus,
  });
}
