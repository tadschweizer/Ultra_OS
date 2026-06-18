import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';

const COMMENT_COLUMNS = 'id, planned_workout_id, athlete_id, coach_id, sender_role, body, created_at, read_at';

async function getOwnCoachProfile(admin, sessionAthleteId) {
  const { data: profile } = await admin
    .from('coach_profiles')
    .select('id')
    .eq('athlete_id', sessionAthleteId)
    .maybeSingle();
  return profile || null;
}

async function canAccessWorkout(admin, sessionAthleteId, workoutId) {
  const { data: workout } = await admin
    .from('planned_workouts')
    .select('id, athlete_id, coach_id')
    .eq('id', workoutId)
    .maybeSingle();
  if (!workout) return { allowed: false };
  if (workout.athlete_id === sessionAthleteId) return { allowed: true, workout, senderRole: 'athlete', coachId: workout.coach_id };

  const profile = await getOwnCoachProfile(admin, sessionAthleteId);
  if (!profile) return { allowed: false, workout };
  const { data: relationship } = await admin
    .from('coach_athlete_relationships')
    .select('id')
    .eq('coach_id', profile.id)
    .eq('athlete_id', workout.athlete_id)
    .eq('status', 'active')
    .maybeSingle();
  return { allowed: Boolean(relationship), workout, senderRole: 'coach', coachId: profile.id };
}

export default async function handler(req, res) {
  const sessionAthleteId = getAthleteIdFromRequest(req);
  if (!sessionAthleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    if (req.method === 'GET') {
      const workoutId = req.query.workout_id;
      if (!workoutId) {
        res.status(400).json({ error: 'workout_id is required.' });
        return;
      }
      const access = await canAccessWorkout(admin, sessionAthleteId, workoutId);
      if (!access.allowed) {
        res.status(403).json({ error: 'Not allowed to read comments for this workout.' });
        return;
      }
      const { data, error } = await admin
        .from('workout_comments')
        .select(COMMENT_COLUMNS)
        .eq('planned_workout_id', workoutId)
        .order('created_at', { ascending: true });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ comments: data || [] });
      return;
    }

    if (req.method === 'POST') {
      const { planned_workout_id: workoutId, body } = req.body || {};
      if (!workoutId || !body?.trim()) {
        res.status(400).json({ error: 'planned_workout_id and body are required.' });
        return;
      }
      const access = await canAccessWorkout(admin, sessionAthleteId, workoutId);
      if (!access.allowed) {
        res.status(403).json({ error: 'Not allowed to comment on this workout.' });
        return;
      }
      const { data, error } = await admin
        .from('workout_comments')
        .insert({
          planned_workout_id: workoutId,
          athlete_id: access.workout.athlete_id,
          coach_id: access.coachId || null,
          sender_role: access.senderRole,
          body: body.trim(),
        })
        .select(COMMENT_COLUMNS)
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      if (access.senderRole === 'athlete' && access.coachId) {
        await admin.from('coach_notifications').insert({
          coach_id: access.coachId,
          athlete_id: access.workout.athlete_id,
          notification_type: 'workout_comment',
          title: 'New workout comment',
          body: body.trim().slice(0, 240),
          entity_type: 'planned_workout',
          entity_id: workoutId,
        });
      }
      res.status(200).json({ comment: data });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[workout-comments] failed:', error);
    res.status(500).json({ error: error.message });
  }
}
