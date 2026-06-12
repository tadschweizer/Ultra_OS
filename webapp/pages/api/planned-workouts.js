import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';
import {
  decorateWorkoutsWithCompliance,
  estimateTss,
  summarizeStructure,
  toDateKey,
} from '../../lib/workoutCompliance';

const PLANNING_FIELDS = [
  'workout_date',
  'sport',
  'title',
  'description',
  'structure',
  'planned_duration_min',
  'planned_distance_km',
  'planned_tss',
  'order_index',
  'library_workout_id',
];

// Fields an athlete may change on a coach-assigned workout (completion only).
const ATHLETE_COMPLETION_FIELDS = [
  'status',
  'completed_activity_id',
  'completed_duration_min',
  'completed_distance_km',
  'athlete_rpe',
  'athlete_comment',
];

const WORKOUT_COLUMNS = `
  id, athlete_id, coach_id, workout_date, sport, title, description, structure,
  planned_duration_min, planned_distance_km, planned_tss, order_index, status,
  completed_activity_id, completed_duration_min, completed_distance_km,
  athlete_rpe, athlete_comment, coach_feedback, library_workout_id, created_at, updated_at
`;

async function getOwnCoachProfile(admin, sessionAthleteId) {
  const { data: profile } = await admin
    .from('coach_profiles')
    .select('id')
    .eq('athlete_id', sessionAthleteId)
    .maybeSingle();
  return profile || null;
}

async function getCoachProfileFor(admin, sessionAthleteId, targetAthleteId) {
  const profile = await getOwnCoachProfile(admin, sessionAthleteId);
  if (!profile) return null;

  const { data: relationship } = await admin
    .from('coach_athlete_relationships')
    .select('id')
    .eq('coach_id', profile.id)
    .eq('athlete_id', targetAthleteId)
    .eq('status', 'active')
    .maybeSingle();

  return relationship ? profile : null;
}

function fillPlannedTotals(payload) {
  const structure = Array.isArray(payload.structure) ? payload.structure : [];
  if (structure.length) {
    const totals = summarizeStructure(structure);
    if (payload.planned_duration_min == null && totals.durationMin > 0) {
      payload.planned_duration_min = totals.durationMin;
    }
    if (payload.planned_distance_km == null && totals.distanceKm > 0) {
      payload.planned_distance_km = totals.distanceKm;
    }
  }
  if (payload.planned_tss == null) {
    payload.planned_tss = estimateTss(structure, payload.planned_duration_min);
  }
  return payload;
}

async function fetchActivitiesForRange(admin, athleteId, start, end) {
  // Synced activities live in strava_activities; some environments also have
  // a generic activities table. A failed query just means "no synced data" —
  // manual completion still works.
  const { data: stravaData, error: stravaError } = await admin
    .from('strava_activities')
    .select('id, start_date, moving_time, distance')
    .eq('athlete_id', athleteId)
    .gte('start_date', `${start}T00:00:00Z`)
    .lte('start_date', `${end}T23:59:59Z`);

  if (!stravaError && stravaData?.length) {
    return stravaData;
  }

  const { data, error } = await admin
    .from('activities')
    .select('id, start_date, moving_time')
    .eq('athlete_id', athleteId)
    .gte('start_date', `${start}T00:00:00Z`)
    .lte('start_date', `${end}T23:59:59Z`);
  if (error) return [];
  return data || [];
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
      const targetAthleteId = typeof req.query.athlete_id === 'string' && req.query.athlete_id
        ? req.query.athlete_id
        : sessionAthleteId;

      if (targetAthleteId !== sessionAthleteId) {
        const profile = await getCoachProfileFor(admin, sessionAthleteId, targetAthleteId);
        if (!profile) {
          res.status(403).json({ error: 'No active coaching relationship with this athlete.' });
          return;
        }
      }

      const today = new Date();
      const defaultStart = new Date(today.getTime() - 14 * 86400000);
      const defaultEnd = new Date(today.getTime() + 28 * 86400000);
      const start = typeof req.query.start === 'string' && req.query.start
        ? req.query.start
        : toDateKey(defaultStart);
      const end = typeof req.query.end === 'string' && req.query.end
        ? req.query.end
        : toDateKey(defaultEnd);

      const [{ data: workouts, error }, activities] = await Promise.all([
        admin
          .from('planned_workouts')
          .select(WORKOUT_COLUMNS)
          .eq('athlete_id', targetAthleteId)
          .gte('workout_date', start)
          .lte('workout_date', end)
          .order('workout_date', { ascending: true })
          .order('order_index', { ascending: true }),
        fetchActivitiesForRange(admin, targetAthleteId, start, end),
      ]);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({
        workouts: decorateWorkoutsWithCompliance(workouts || [], activities),
        range: { start, end },
      });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const targetAthleteId = body.athlete_id || sessionAthleteId;

      let coachProfile = null;
      if (targetAthleteId !== sessionAthleteId) {
        coachProfile = await getCoachProfileFor(admin, sessionAthleteId, targetAthleteId);
        if (!coachProfile) {
          res.status(403).json({ error: 'No active coaching relationship with this athlete.' });
          return;
        }
      }

      // ── Copy a whole week of planning forward ────────────────────────────
      if (body.action === 'copy_week') {
        if (!body.from_week_start || !body.to_week_start) {
          res.status(400).json({ error: 'from_week_start and to_week_start are required.' });
          return;
        }
        const fromStart = new Date(`${body.from_week_start}T00:00:00Z`);
        const fromEnd = new Date(fromStart.getTime() + 6 * 86400000);
        const offsetDays = Math.round(
          (new Date(`${body.to_week_start}T00:00:00Z`) - fromStart) / 86400000
        );

        const { data: sourceWorkouts, error: sourceError } = await admin
          .from('planned_workouts')
          .select(WORKOUT_COLUMNS)
          .eq('athlete_id', targetAthleteId)
          .gte('workout_date', toDateKey(fromStart))
          .lte('workout_date', toDateKey(fromEnd));
        if (sourceError) {
          res.status(500).json({ error: sourceError.message });
          return;
        }
        if (!sourceWorkouts?.length) {
          res.status(400).json({ error: 'No workouts found in the source week.' });
          return;
        }

        const clones = sourceWorkouts.map((w) => {
          const date = new Date(`${w.workout_date}T00:00:00Z`);
          date.setUTCDate(date.getUTCDate() + offsetDays);
          return {
            athlete_id: targetAthleteId,
            coach_id: coachProfile ? coachProfile.id : null,
            workout_date: toDateKey(date),
            sport: w.sport,
            title: w.title,
            description: w.description,
            structure: w.structure,
            planned_duration_min: w.planned_duration_min,
            planned_distance_km: w.planned_distance_km,
            planned_tss: w.planned_tss,
            order_index: w.order_index,
            library_workout_id: w.library_workout_id,
          };
        });

        const { data: created, error: insertError } = await admin
          .from('planned_workouts')
          .insert(clones)
          .select(WORKOUT_COLUMNS);
        if (insertError) {
          res.status(500).json({ error: insertError.message });
          return;
        }
        res.status(200).json({ workouts: created || [] });
        return;
      }

      // ── Create a single workout (optionally from the library) ────────────
      let payload = {
        athlete_id: targetAthleteId,
        coach_id: coachProfile ? coachProfile.id : null,
      };

      if (body.library_workout_id) {
        // Library workouts are private to the coach who created them — scope
        // the lookup to the requester's own coach profile so knowing a UUID
        // is never enough to clone another coach's template.
        const requesterProfile = coachProfile || await getOwnCoachProfile(admin, sessionAthleteId);
        if (!requesterProfile) {
          res.status(403).json({ error: 'Workout library is available to coach accounts.' });
          return;
        }
        const { data: libraryWorkout } = await admin
          .from('workout_library')
          .select('*')
          .eq('id', body.library_workout_id)
          .eq('coach_id', requesterProfile.id)
          .maybeSingle();
        if (!libraryWorkout) {
          res.status(404).json({ error: 'Library workout not found.' });
          return;
        }
        payload = {
          ...payload,
          sport: libraryWorkout.sport,
          title: libraryWorkout.name,
          description: libraryWorkout.description,
          structure: libraryWorkout.structure,
          planned_duration_min: libraryWorkout.planned_duration_min,
          planned_distance_km: libraryWorkout.planned_distance_km,
          planned_tss: libraryWorkout.planned_tss,
          library_workout_id: libraryWorkout.id,
        };
      }

      PLANNING_FIELDS.forEach((field) => {
        if (body[field] !== undefined) payload[field] = body[field];
      });

      if (!payload.workout_date || !payload.title) {
        res.status(400).json({ error: 'workout_date and title are required.' });
        return;
      }

      fillPlannedTotals(payload);

      const { data: created, error: insertError } = await admin
        .from('planned_workouts')
        .insert(payload)
        .select(WORKOUT_COLUMNS)
        .single();
      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }
      res.status(200).json({ workout: created });
      return;
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (!body.id) {
        res.status(400).json({ error: 'id is required.' });
        return;
      }

      const { data: existing, error: fetchError } = await admin
        .from('planned_workouts')
        .select(WORKOUT_COLUMNS)
        .eq('id', body.id)
        .maybeSingle();
      if (fetchError || !existing) {
        res.status(404).json({ error: 'Workout not found.' });
        return;
      }

      const isOwnCalendar = existing.athlete_id === sessionAthleteId;
      let allowedFields = null;

      if (isOwnCalendar && !existing.coach_id) {
        // Self-planned: the athlete owns everything.
        allowedFields = [...PLANNING_FIELDS, ...ATHLETE_COMPLETION_FIELDS];
      } else if (isOwnCalendar) {
        // Coach-assigned: athlete records completion only.
        allowedFields = ATHLETE_COMPLETION_FIELDS;
      } else {
        const profile = await getCoachProfileFor(admin, sessionAthleteId, existing.athlete_id);
        if (!profile) {
          res.status(403).json({ error: 'Not allowed to edit this workout.' });
          return;
        }
        if (existing.coach_id === profile.id) {
          // The assigning coach owns the plan.
          allowedFields = [...PLANNING_FIELDS, 'status', 'coach_feedback'];
        } else {
          // Another active coach (or a self-planned workout): feedback only —
          // never another coach's planning fields.
          allowedFields = ['coach_feedback'];
        }
      }

      const updates = {};
      allowedFields.forEach((field) => {
        if (body[field] !== undefined) updates[field] = body[field];
      });
      if (!Object.keys(updates).length) {
        res.status(400).json({ error: 'No editable fields provided.' });
        return;
      }
      if (updates.status && !['planned', 'completed', 'skipped'].includes(updates.status)) {
        res.status(400).json({ error: 'Invalid status.' });
        return;
      }
      if (updates.structure !== undefined) {
        // Recompute totals from the new structure unless explicitly provided.
        const recomputed = fillPlannedTotals({
          structure: updates.structure,
          planned_duration_min: updates.planned_duration_min ?? null,
          planned_distance_km: updates.planned_distance_km ?? null,
          planned_tss: updates.planned_tss ?? null,
        });
        updates.planned_duration_min = recomputed.planned_duration_min;
        updates.planned_distance_km = recomputed.planned_distance_km;
        updates.planned_tss = recomputed.planned_tss;
      }
      updates.updated_at = new Date().toISOString();

      const { data: updated, error: updateError } = await admin
        .from('planned_workouts')
        .update(updates)
        .eq('id', body.id)
        .select(WORKOUT_COLUMNS)
        .single();
      if (updateError) {
        res.status(500).json({ error: updateError.message });
        return;
      }
      res.status(200).json({ workout: updated });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) {
        res.status(400).json({ error: 'id is required.' });
        return;
      }

      const { data: existing } = await admin
        .from('planned_workouts')
        .select('id, athlete_id, coach_id')
        .eq('id', id)
        .maybeSingle();
      if (!existing) {
        res.status(404).json({ error: 'Workout not found.' });
        return;
      }

      const isSelfPlanned = existing.athlete_id === sessionAthleteId && !existing.coach_id;
      let allowed = isSelfPlanned;
      if (!allowed && existing.coach_id) {
        // Only the coach who assigned the workout may delete it.
        const profile = await getCoachProfileFor(admin, sessionAthleteId, existing.athlete_id);
        allowed = Boolean(profile && existing.coach_id === profile.id);
      }
      if (!allowed) {
        res.status(403).json({ error: 'Not allowed to delete this workout.' });
        return;
      }

      const { error: deleteError } = await admin
        .from('planned_workouts')
        .delete()
        .eq('id', id);
      if (deleteError) {
        res.status(500).json({ error: deleteError.message });
        return;
      }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[planned-workouts] failed:', error);
    res.status(500).json({ error: error.message });
  }
}
