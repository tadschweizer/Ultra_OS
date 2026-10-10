import { validateWorkoutFields, validWorkoutRequestId, sameWorkoutRequest } from '../../lib/workoutValidation.js';
import { decideWorkoutMatch } from '../../lib/workoutMatch.js';
import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { canReadWorkout, filterReadableWorkouts } from '../../lib/workoutVisibility.js';

import {
  decorateWorkoutsWithCompliance,
  activityDateKey,
  estimateTss,
  normalizeSport,
  summarizeStructure,
  toDateKey,
} from '../../lib/workoutCompliance.js';
import { getEffectiveAthleteIdFromRequest } from '../../lib/auth/requireAthlete.js';
import { syncAthleteActivities, getStoredActivities } from '../../lib/activitySync.js';
import {
  loadAccountAccess,
  loadActiveCoachRelationship,
} from '../../lib/auth/roleAccessServer.js';

// Matches the rolling window a routine sync pulls; older ranges need a widened
// request so scrolling back through history fills in rather than staying blank.
const INCREMENTAL_WINDOW_MS = 60 * 86400000;

const PLANNING_FIELDS = [
  'workout_date',
  'sport',
  'title',
  'description',
  'structure',
  'planned_duration_min',
  'planned_distance_km',
  'planned_distance_unit',
  'planned_tss',
  'order_index',
  'library_workout_id',
  'objective',
  'coach_instructions',
  'target_metric',
  'planned_if',
  'visibility',
  'export_status',
  'sync_provider',
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
  objective, coach_instructions, target_metric, planned_if, visibility, export_status, sync_provider,
  planned_duration_min, planned_distance_km, planned_distance_unit, planned_tss, order_index, status,
  completed_activity_id, activity_match_mode, completed_duration_min, completed_distance_km,
  athlete_rpe, athlete_comment, coach_feedback, library_workout_id, created_at, updated_at
`;

async function getOwnCoachProfile(admin, sessionAthleteId) {
  const access = await loadAccountAccess(admin, sessionAthleteId);
  return access?.capabilities.coach ? access.coachProfile : null;
}

async function getCoachProfileFor(admin, sessionAthleteId, targetAthleteId) {
  const profile = await getOwnCoachProfile(admin, sessionAthleteId);
  if (!profile) return null;

  const relationship = await loadActiveCoachRelationship(admin, profile.id, targetAthleteId);

  return relationship ? profile : null;
}

function fillPlannedTotals(payload) {
  const structure = Array.isArray(payload.structure) ? payload.structure : [];
  if (structure.length) {
    const totals = summarizeStructure(structure);
    if (payload.planned_duration_min === undefined && totals.durationMin > 0) {
      payload.planned_duration_min = totals.durationMin;
    }
    if (payload.planned_distance_km === undefined && totals.distanceKm > 0) {
      payload.planned_distance_km = totals.distanceKm;
    }
  }
  if (payload.planned_tss === undefined) {
    payload.planned_tss = estimateTss(structure, payload.planned_duration_min);
  }
  return payload;
}

/**
 * Loads imported activities for the range, refreshing from the provider first.
 *
 * The sync is throttled and never throws, so this costs one upstream call at
 * most every few minutes and always returns whatever is stored. Ranges that
 * reach further back than the rolling window ask for a widened pull, which is
 * how an athlete scrolling into older history fills it in.
 */
async function fetchActivitiesForRange(admin, athleteId, start, end) {
  const rangeStartMs = new Date(`${start}T00:00:00Z`).getTime();
  const needsHistory = Number.isFinite(rangeStartMs)
    && rangeStartMs < Date.now() - INCREMENTAL_WINDOW_MS;

  const sync = await syncAthleteActivities(admin, athleteId, needsHistory ? { since: `${start}T00:00:00Z` } : {});
  const activities = await getStoredActivities(admin, athleteId, start, end);
  // The sync reports not_connected before any throttling, so this is reliable
  // on every request. It lets a coach tell "no training" from "no import source".
  return { activities, stravaConnected: sync?.reason !== 'not_connected' };
}

/**
 * Comment counts per subject, so a calendar card can show that a conversation
 * exists without loading the thread. A failure degrades to "no badge".
 *
 * `column` is the subject key on workout_comments — planned_workout_id for
 * plans, activity_id for imported sessions.
 */
async function fetchCommentCounts(admin, column, ids) {
  const counts = new Map();
  if (!ids.length) return counts;

  const { data, error } = await admin
    .from('workout_comments')
    .select(column)
    .in(column, ids);

  if (error) {
    console.error('[planned-workouts] comment counts failed:', error.message);
    return counts;
  }
  (data || []).forEach((row) => {
    const id = row[column];
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });
  return counts;
}

// Bound lookups below PostgREST's row limit instead of scanning all history.
async function fetchInBatches(admin, table, columns, athleteId, column, ids) {
  const rows = [];
  for (let start = 0; start < ids.length; start += 100) {
    const result = await admin.from(table).select(columns).eq('athlete_id', athleteId).in(column, ids.slice(start, start + 100));
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
  }
  return rows;
}

// Trims a stored activity down to what the calendar renders for a session that
// had no matching plan. local_date keeps an evening session on the athlete's
// own day; legacy rows without it fall back to the UTC instant.
function toCalendarActivity(activity) {
  const distanceM = activity.distance != null ? Number(activity.distance) : null;
  const movingSec = activity.moving_time != null ? Number(activity.moving_time) : null;
  const elapsedSec = activity.elapsed_time != null ? Number(activity.elapsed_time) : null;
  return {
    id: activity.id,
    start_date: activity.start_date,
    activity_date: activityDateKey(activity),
    name: activity.name || activity.activity_name || 'Imported activity',
    sport: normalizeSport(activity.sport_type || activity.type || activity.sport) || 'other',
    duration_min: movingSec != null ? Math.round((movingSec / 60) * 10) / 10 : null,
    elapsed_min: elapsedSec != null ? Math.round((elapsedSec / 60) * 10) / 10 : null,
    distance_km: distanceM != null ? Math.round((distanceM / 1000) * 100) / 100 : null,
    elevation_gain_m: activity.total_elevation_gain != null ? Math.round(Number(activity.total_elevation_gain)) : null,
    average_heartrate: activity.average_heartrate != null ? Math.round(Number(activity.average_heartrate)) : null,
    max_heartrate: activity.max_heartrate != null ? Math.round(Number(activity.max_heartrate)) : null,
    kilojoules: activity.kilojoules != null ? Math.round(Number(activity.kilojoules)) : null,
    calories: activity.calories != null ? Math.round(Number(activity.calories)) : null,
    tss: activity.tss != null ? Math.round(Number(activity.tss)) : null,
    source: activity.source || 'strava',
    // Detail-view fields. The calendar card ignores these, but carrying them in
    // the same payload means opening a session costs no extra round trip.
    description: activity.description || null,
    average_speed_mps: activity.average_speed != null ? Number(activity.average_speed) : null,
    max_speed_mps: activity.max_speed != null ? Number(activity.max_speed) : null,
    average_cadence: activity.average_cadence != null ? Math.round(Number(activity.average_cadence)) : null,
    intensity_factor: activity.intensity_factor != null ? Number(activity.intensity_factor) : null,
    suffer_score: activity.suffer_score != null ? Math.round(Number(activity.suffer_score)) : null,
    elev_high_m: activity.elev_high != null ? Math.round(Number(activity.elev_high)) : null,
    elev_low_m: activity.elev_low != null ? Math.round(Number(activity.elev_low)) : null,
    trainer: activity.trainer ?? null,
    commute: activity.commute ?? null,
    manual: activity.manual ?? null,
  };
}

export function createPlannedWorkoutsHandler({
  resolveAthlete = getEffectiveAthleteIdFromRequest,
  getAdmin = getSupabaseAdminClient,
  fetchActivities = fetchActivitiesForRange,
} = {}) {
return async function handler(req, res) {
  const sessionAthleteId = await resolveAthlete(req);
  if (!sessionAthleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getAdmin();

  try {
    if (req.method === 'GET') {
      const targetAthleteId = typeof req.query.athlete_id === 'string' && req.query.athlete_id
        ? req.query.athlete_id
        : sessionAthleteId;

      let readerCoach = null;
      if (targetAthleteId !== sessionAthleteId) {
        const profile = await getCoachProfileFor(admin, sessionAthleteId, targetAthleteId);
        if (!profile) {
          res.status(403).json({ error: 'No active coaching relationship with this athlete.' });
          return;
        }
        readerCoach = profile;
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

      const [{ data: rangeWorkouts, error }, { activities, stravaConnected }] = await Promise.all([
        admin
          .from('planned_workouts')
          .select(WORKOUT_COLUMNS)
          .eq('athlete_id', targetAthleteId)
          .gte('workout_date', start)
          .lte('workout_date', end)
          .order('workout_date', { ascending: true })
          .order('order_index', { ascending: true }),
        fetchActivities(admin, targetAthleteId, start, end),
      ]);

      if (error) {
        res.status(500).json({ error: 'Could not load workouts. Please retry.' });
        return;
      }

      // Bring the confirmed plan along when its activity falls in the visible
      // range, even if the original plan date is elsewhere. Reserving the
      // activity alone would hide the completed session from this calendar.
      const links = await fetchInBatches(admin, 'planned_workouts', 'id, completed_activity_id',
        targetAthleteId, 'completed_activity_id', [...new Set(activities.map((a) => String(a.id)))]);
      const rangeIds = new Set((rangeWorkouts || []).map((w) => w.id));
      const outsidePlans = await fetchInBatches(admin, 'planned_workouts', WORKOUT_COLUMNS,
        targetAthleteId, 'id', links.filter((w) => !rangeIds.has(w.id)).map((w) => w.id));
      const workouts = filterReadableWorkouts([...(rangeWorkouts || []), ...outsidePlans],
        { athleteId: sessionAthleteId, coachId: readerCoach?.id });
      const missing = workouts.map((w) => w.completed_activity_id)
        .filter((id) => validWorkoutRequestId(id) && !activities.some((a) => String(a.id) === id));
      let linkedActivities = [];
      if (missing.length) {
        linkedActivities = await fetchInBatches(admin, 'strava_activities', '*', targetAthleteId, 'id', missing);
      }
      const availableActivities = [...activities, ...linkedActivities];
      const linkOwners = new Map(workouts.filter((w) => w.completed_activity_id).map((w) => [w.completed_activity_id, w.id]));

      // Fulfill a plan from an activity up to a day off the planned date, so a
      // long run done Sunday still completes a Saturday plan.
      const decorated = decorateWorkoutsWithCompliance(workouts || [], availableActivities, { toleranceDays: 1 });

      // Any synced activity a plan didn't consume is shown on its own day, so
      // past training is visible even where nothing was scheduled.
      const consumed = new Set();
      decorated.forEach((w) => {
        if (w.matched_activity?.id != null) consumed.add(String(w.matched_activity.id));
        if (w.completed_activity_id != null) consumed.add(String(w.completed_activity_id));
      });
      const unplannedActivities = (activities || [])
        .filter((a) => a?.start_date && !consumed.has(String(a.id)))
        .map(toCalendarActivity);

      const [workoutComments, activityComments] = await Promise.all([
        fetchCommentCounts(admin, 'planned_workout_id', decorated.map((w) => w.id)),
        fetchCommentCounts(admin, 'activity_id', unplannedActivities.map((a) => a.id)),
      ]);

      res.status(200).json({
        workouts: decorated.map((w) => ({ ...w, comment_count: workoutComments.get(w.id) || 0 })),
        activities: unplannedActivities.map((a) => ({ ...a, comment_count: activityComments.get(a.id) || 0 })),
        match_activities: availableActivities.map((a) => ({ ...toCalendarActivity(a),
          linked_workout_id: linkOwners.get(String(a.id)) || null })),
        range: { start, end },
        import_source: { strava_connected: stravaConnected },
      });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.completed_activity_id != null) return res.status(400).json({ error: 'Create the workout first, then choose an imported activity in its details.' });
      if (body.client_request_id != null && !validWorkoutRequestId(body.client_request_id)) {
        return res.status(400).json({ error: 'Invalid workout retry key.' });
      }
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
        if (!validWorkoutRequestId(body.client_request_id)) return res.status(400).json({ error: 'Reload the calendar before copying this week.' });
        for (const date of [body.from_week_start, body.to_week_start]) {
          if (!date || validateWorkoutFields({ workout_date: date })) return res.status(400).json({ error: 'Choose valid source and destination weeks.' });
        }
        if (body.from_week_start === body.to_week_start) return res.status(400).json({ error: 'Choose a different destination week.' });
        // A single DB transaction owns retry identity and the complete insert.
        // Authorization is checked here and again inside the service-only RPC.
        const { data, error } = await admin.rpc('copy_planned_workout_week', {
          p_actor_id: sessionAthleteId, p_athlete_id: targetAthleteId,
          p_request_id: body.client_request_id, p_from: body.from_week_start, p_to: body.to_week_start,
        });
        if (error) {
          const status = error.code === '42501' ? 403 : error.code === 'PT409' ? 409 : error.code === '22023' ? 400 : 503;
          const message = status === 403 ? 'No active coaching relationship with this athlete.'
            : status === 409 ? 'This copy already saved different details. Review the calendar before copying again.'
            : status === 400 ? 'No visible workouts found in the source week.'
            : 'Week copying is unavailable. Your retry has not been discarded. Please retry.';
          return res.status(status).json({ error: message });
        }
        return res.status(200).json(data);
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
        const { data: libraryWorkout, error: libraryError } = await admin
          .from('workout_library')
          .select('*')
          .eq('id', body.library_workout_id)
          .eq('coach_id', requesterProfile.id)
          .maybeSingle();
        if (libraryError) return res.status(503).json({ error: 'Library assignment is unavailable. Please retry.' });
        if (!libraryWorkout) {
          res.status(404).json({ error: 'Library workout not found.' });
          return;
        }
        const metadataFields = ['objective', 'coach_instructions', 'target_metric', 'planned_if', 'visibility'];
        if (!metadataFields.every(field => Object.hasOwn(libraryWorkout, field))) return res.status(503).json({ error: 'Full prescription library assignment is unavailable until the library schema update is installed.' });
        payload = {
          ...payload,
          sport: libraryWorkout.sport,
          title: libraryWorkout.name,
          description: libraryWorkout.description,
          objective: libraryWorkout.objective,
          coach_instructions: libraryWorkout.coach_instructions,
          target_metric: libraryWorkout.target_metric,
          planned_if: libraryWorkout.planned_if,
          visibility: libraryWorkout.visibility,
          structure: libraryWorkout.structure,
          planned_duration_min: libraryWorkout.planned_duration_min,
          planned_distance_km: libraryWorkout.planned_distance_km,
          planned_distance_unit: libraryWorkout.planned_distance_unit || 'mi',
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

      if (targetAthleteId === sessionAthleteId && body.status === 'completed') {
        for (const field of ATHLETE_COMPLETION_FIELDS) if (body[field] !== undefined) payload[field] = body[field];
      }
      const validationError = validateWorkoutFields(payload);
      if (validationError) return res.status(400).json({ error: validationError });
      if (!coachProfile && payload.visibility === 'coach_private') return res.status(403).json({ error: 'Only an assigning coach can create a private draft.' });
      if (payload.status !== 'completed') fillPlannedTotals(payload);
      if (payload.status === 'completed') payload.activity_match_mode = 'manual';
      if (body.client_request_id) payload.id = body.client_request_id;

      const { data: created, error: insertError } = await admin
        .from('planned_workouts')
        .insert(payload)
        .select(WORKOUT_COLUMNS)
        .single();
      if (insertError) {
        if (insertError.code === '23505' && body.client_request_id) {
          const { data: original, error: retryError } = await admin.from('planned_workouts')
            .select(WORKOUT_COLUMNS).eq('id', body.client_request_id).eq('athlete_id', targetAthleteId).maybeSingle();
          if (!retryError && sameWorkoutRequest(original, payload)) return res.status(200).json({ workout: original });
          return res.status(409).json({ error: 'This save already exists with different details. Close this editor and review the calendar before making another change.' });
        }
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
      if (isOwnCalendar && !canReadWorkout(existing, { athleteId: sessionAthleteId })) return res.status(404).json({ error: 'Workout not found.' });
      if (body.match_action !== undefined) {
        if (!isOwnCalendar) return res.status(403).json({ error: 'Only the athlete can change this workout match.' });
        const result = await decideWorkoutMatch(admin, sessionAthleteId, body);
        return res.status(result.status).json(result.error ? { error: result.error } : { workout: result.workout });
      }
      if (body.completed_activity_id != null || body.activity_match_mode !== undefined) {
        return res.status(400).json({ error: 'Use the workout match controls to change an imported activity.' });
      }
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
        if (!canReadWorkout(existing, { coachId: profile.id })) return res.status(404).json({ error: 'Workout not found.' });
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
      const validationError = validateWorkoutFields(updates);
      if (validationError) return res.status(400).json({ error: validationError });
      if (isOwnCalendar && updates.visibility === 'coach_private') return res.status(403).json({ error: 'Only an assigning coach can create a private draft.' });
      // Manual completion/skip/undo replaces the link; the imported session
      // returns to the calendar and subsequent imports cannot undo this choice.
      if (updates.status !== undefined || updates.completed_duration_min !== undefined || updates.completed_distance_km !== undefined) {
        updates.completed_activity_id = null;
        updates.activity_match_mode = 'manual';
        if (updates.status === 'planned' || updates.status === 'skipped') {
          updates.completed_duration_min = null;
          updates.completed_distance_km = null;
        }
      }
      updates.updated_at = new Date().toISOString();

      let updateQuery = admin
        .from('planned_workouts')
        .update(updates)
        .eq('id', body.id);
      if (body.expected_updated_at) updateQuery = updateQuery.eq('updated_at', body.expected_updated_at);
      const { data: updated, error: updateError } = await updateQuery.select(WORKOUT_COLUMNS).maybeSingle();
      if (updateError) {
        res.status(500).json({ error: updateError.message });
        return;
      }
      if (!updated) return res.status(409).json({ error: 'This workout changed in another session. Close and reopen it before saving.' });
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
        .select('id, athlete_id, coach_id, visibility')
        .eq('id', id)
        .maybeSingle();
      if (!existing) {
        res.status(404).json({ error: 'Workout not found.' });
        return;
      }
      if (existing.athlete_id === sessionAthleteId && !canReadWorkout(existing, { athleteId: sessionAthleteId })) return res.status(404).json({ error: 'Workout not found.' });

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
    res.status(500).json({ error: 'Could not complete this calendar request. Please retry.' });
  }
}
}

export default createPlannedWorkoutsHandler();
