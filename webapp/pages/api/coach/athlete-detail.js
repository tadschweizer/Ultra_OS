import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { buildCoachReport, reportWindow } from '../../../lib/coachReport.js';
import { buildAthleteImportHealth } from '../../../lib/importHealth.js';
import { filterReadableWorkouts } from '../../../lib/workoutVisibility.js';
import {
  requireActiveCoachRelationship,
  requireCoachAccess,
} from '../../../lib/auth/roleAccessServer.js';

// Coach tables are no longer reachable with the public anon key (RLS is on and
// the anon grants are revoked), so this route uses the service-role client.
// Authorisation is enforced in the handler from the session athlete id.

export function createCoachAthleteDetailHandler({ getAdmin = getSupabaseAdminClient } = {}) {
return async function handler(req, res) {
  const supabase = getAdmin();
  if (req.method !== 'GET') return res.status(405).end();
  const athleteId = req.query.athlete_id;
  const access = await requireCoachAccess(req, res, supabase);
  if (!access) return;
  if (!athleteId) return res.status(400).json({ error: 'athlete_id is required' });

  const coachProfile = access.profile;
  const relationship = await requireActiveCoachRelationship(
    res,
    supabase,
    coachProfile.id,
    athleteId
  );
  if (!relationship) return;

  const window = reportWindow();
  const reconciliationStart = window.start;
  const startTime = `${window.start}T00:00:00Z`;
  const endTime = `${window.end}T23:59:59.999999Z`;
  try {

  const [athleteRes, racesRes, protocolsRes, interventionsRes, activitiesRes, checkinsRes, fastCheckinsRes, notesRes, plannedWorkoutsRes, reconActivitiesRes, importJobsRes] = await Promise.all([
    supabase.from('athletes').select('id, name, email, primary_sports').eq('id', athleteId).maybeSingle(),
    supabase.from('races').select('id, name, event_date, race_type').eq('athlete_id', athleteId).gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(1),
    supabase.from('coach_protocol_assignments').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false }),
    supabase.from('interventions').select('*').eq('athlete_id', athleteId).gte('date', window.start).lte('date', window.end).order('date', { ascending: false }).order('inserted_at', { ascending: false }).limit(8),
    supabase.from('strava_activities').select('*').eq('athlete_id', athleteId).gte('start_date', startTime).lte('start_date', endTime).order('start_date', { ascending: false }).limit(8),
    supabase.from('daily_checkins').select('*').eq('athlete_id', athleteId).gte('created_at', startTime).lte('created_at', endTime).order('created_at', { ascending: false }).limit(8),
    supabase.from('interventions').select('date, inserted_at, intervention_type, protocol_payload').eq('athlete_id', athleteId).eq('intervention_type', 'Workout Check-in').gte('date', window.start).lte('date', window.end).order('date', { ascending: false }).order('inserted_at', { ascending: false }).limit(30),
    supabase.from('coach_notes').select('*').eq('coach_id', coachProfile.id).eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(10),
    supabase.from('planned_workouts').select('*').eq('athlete_id', athleteId).gte('workout_date', reconciliationStart).order('workout_date', { ascending: true }),
    supabase.from('strava_activities').select('*').eq('athlete_id', athleteId).gte('start_date', reconciliationStart).order('start_date', { ascending: true }),
    supabase.from('trainingpeaks_import_jobs').select('id, status, transferred_count, needs_manual_mapping_count, error_message, created_at, updated_at, followup_sent_at').eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(5),
  ]);

  if ([athleteRes, racesRes, protocolsRes, interventionsRes, activitiesRes, checkinsRes, fastCheckinsRes, notesRes, plannedWorkoutsRes, reconActivitiesRes, importJobsRes].some(result => result.error)) {
    return res.status(503).json({ error: 'Athlete report unavailable. Please try again.' });
  }
  if (!athleteRes.data) return res.status(404).json({ error: 'Athlete record not found.' });

  const protocols = protocolsRes.data || [];
  const interventions = interventionsRes.data || [];
  const checkins = checkinsRes.data || [];
  const activeProtocols = protocols.filter((p) => ['assigned', 'in_progress', 'active'].includes(p.status));
  const { compliance, riskLevel, raceReadiness } = buildCoachReport({ upcomingRace: (racesRes.data || [])[0] || null, activeProtocols, activities: activitiesRes.data || [], checkins, interventions, fastCheckins: fastCheckinsRes.data || [], window });

  res.status(200).json({
    athlete: athleteRes.data,
    relationship,
    upcomingRace: (racesRes.data || [])[0] || null,
    protocols,
    compliance,
    interventions,
    activities: activitiesRes.data || [],
    plannedWorkouts: filterReadableWorkouts(plannedWorkoutsRes.data, { coachId: coachProfile.id }),
    reconciliationActivities: reconActivitiesRes.data || [],
    checkins,
    importJobs: importJobsRes.data || [],
    importHealth: buildAthleteImportHealth((importJobsRes.data || [])[0] || null),
    coachNotes: notesRes.data || [],
    riskLevel,
    suggestedAction: raceReadiness.suggestedAction,
    raceReadiness,
  });
  } catch {
    return res.status(503).json({ error: 'Athlete report unavailable. Please try again.' });
  }
}
}
export default createCoachAthleteDetailHandler();
