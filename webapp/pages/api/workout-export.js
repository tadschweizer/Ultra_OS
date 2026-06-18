import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';

async function getOwnCoachProfile(admin, athleteId) {
  const { data: profile } = await admin.from('coach_profiles').select('id').eq('athlete_id', athleteId).maybeSingle();
  return profile || null;
}

export default async function handler(req, res) {
  const sessionAthleteId = getAthleteIdFromRequest(req);
  if (!sessionAthleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const workoutId = req.query.id;
  if (!workoutId) {
    res.status(400).json({ error: 'id is required.' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const { data: workout, error } = await admin
    .from('planned_workouts')
    .select('*')
    .eq('id', workoutId)
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!workout) {
    res.status(404).json({ error: 'Workout not found.' });
    return;
  }

  let allowed = workout.athlete_id === sessionAthleteId;
  if (!allowed) {
    const profile = await getOwnCoachProfile(admin, sessionAthleteId);
    if (profile) {
      const { data: relationship } = await admin
        .from('coach_athlete_relationships')
        .select('id')
        .eq('coach_id', profile.id)
        .eq('athlete_id', workout.athlete_id)
        .eq('status', 'active')
        .maybeSingle();
      allowed = Boolean(relationship);
    }
  }
  if (!allowed) {
    res.status(403).json({ error: 'Not allowed to export this workout.' });
    return;
  }

  const payload = {
    format: 'threshold-structured-workout-v1',
    id: workout.id,
    title: workout.title,
    sport: workout.sport,
    date: workout.workout_date,
    objective: workout.objective,
    instructions: workout.coach_instructions || workout.description,
    targets: {
      primaryMetric: workout.target_metric || 'duration',
      durationMin: workout.planned_duration_min,
      distanceKm: workout.planned_distance_km,
      tss: workout.planned_tss,
      intensityFactor: workout.planned_if,
    },
    steps: Array.isArray(workout.structure) ? workout.structure : [],
  };

  await admin
    .from('planned_workouts')
    .update({ export_status: 'exported', sync_provider: 'json' })
    .eq('id', workout.id);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${workout.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${workout.workout_date}.json"`);
  res.status(200).send(JSON.stringify(payload, null, 2));
}
