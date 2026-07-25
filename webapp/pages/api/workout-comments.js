import { getSupabaseAdminClient } from '../../lib/authServer';
import { getEffectiveAthleteIdFromRequest } from '../../lib/auth/requireAthlete.js';
import {
  attachAuthorNames,
  collectIds,
  parseSubject,
  validateCommentBody,
} from '../../lib/workoutComments.js';

const COMMENT_COLUMNS = 'id, planned_workout_id, activity_id, athlete_id, coach_id, author_athlete_id, sender_role, body, created_at, read_at';

async function getOwnCoachProfile(admin, sessionAthleteId) {
  const { data: profile } = await admin
    .from('coach_profiles')
    .select('id, display_name')
    .eq('athlete_id', sessionAthleteId)
    .maybeSingle();
  return profile || null;
}

/**
 * Resolves the caller's relationship to a thread's owning athlete.
 *
 * The owner always speaks as the athlete. Anyone else needs a coach profile
 * with an active relationship to that athlete; there is no third role, so a
 * caller who is neither is refused.
 */
async function resolveAccess(admin, sessionAthleteId, ownerAthleteId) {
  if (ownerAthleteId === sessionAthleteId) {
    return { allowed: true, senderRole: 'athlete' };
  }

  const profile = await getOwnCoachProfile(admin, sessionAthleteId);
  if (!profile) return { allowed: false };

  const { data: relationship } = await admin
    .from('coach_athlete_relationships')
    .select('id')
    .eq('coach_id', profile.id)
    .eq('athlete_id', ownerAthleteId)
    .eq('status', 'active')
    .maybeSingle();

  if (!relationship) return { allowed: false };
  return { allowed: true, senderRole: 'coach', coachId: profile.id };
}

/**
 * Loads the subject of a thread — a planned workout or an imported activity —
 * and authorizes the caller against the athlete who owns it.
 */
async function resolveSubject(admin, sessionAthleteId, { workoutId, activityId }) {
  if (workoutId) {
    const { data: workout } = await admin
      .from('planned_workouts')
      .select('id, athlete_id, coach_id')
      .eq('id', workoutId)
      .maybeSingle();
    if (!workout) return { allowed: false, notFound: true };

    const access = await resolveAccess(admin, sessionAthleteId, workout.athlete_id);
    return {
      ...access,
      ownerAthleteId: workout.athlete_id,
      // The plan already records who assigned it, so an athlete's reply has a
      // coach to notify even though the athlete has no coach profile.
      assignedCoachId: workout.coach_id || null,
      match: { planned_workout_id: workout.id },
    };
  }

  const { data: activity } = await admin
    .from('strava_activities')
    .select('id, athlete_id')
    .eq('id', activityId)
    .maybeSingle();
  if (!activity) return { allowed: false, notFound: true };

  const access = await resolveAccess(admin, sessionAthleteId, activity.athlete_id);
  return {
    ...access,
    ownerAthleteId: activity.athlete_id,
    // Imported activities carry no coach column; the coach to notify is looked
    // up from the relationship only when a comment is actually posted.
    assignedCoachId: null,
    match: { activity_id: activity.id },
  };
}

/**
 * The coach an athlete's comment should notify.
 *
 * Only called when posting, so a read never pays for the lookup. An athlete
 * with no coach yields null and no notification is written.
 */
async function resolveNotifyCoachId(admin, subject) {
  if (subject.assignedCoachId) return subject.assignedCoachId;

  const { data: relationship } = await admin
    .from('coach_athlete_relationships')
    .select('coach_id')
    .eq('athlete_id', subject.ownerAthleteId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return relationship?.coach_id || null;
}

/** Loads the display names a thread needs, then labels each comment. */
async function withAuthorNames(admin, comments) {
  if (!comments.length) return comments;

  const athleteIds = collectIds(comments, 'author_athlete_id');
  const coachIds = collectIds(comments, 'coach_id');

  const [athletesRes, coachesRes] = await Promise.all([
    athleteIds.length
      ? admin.from('athletes').select('id, name').in('id', athleteIds)
      : Promise.resolve({ data: [] }),
    coachIds.length
      ? admin.from('coach_profiles').select('id, display_name').in('id', coachIds)
      : Promise.resolve({ data: [] }),
  ]);

  return attachAuthorNames(comments, {
    athleteNames: new Map((athletesRes.data || []).map((a) => [a.id, a.name])),
    coachNames: new Map((coachesRes.data || []).map((c) => [c.id, c.display_name])),
  });
}

export default async function handler(req, res) {
  const sessionAthleteId = await getEffectiveAthleteIdFromRequest(req);
  if (!sessionAthleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    if (req.method === 'GET') {
      const { workoutId, activityId, error: subjectError } = parseSubject(req.query);
      if (subjectError) {
        res.status(400).json({ error: subjectError });
        return;
      }

      const subject = await resolveSubject(admin, sessionAthleteId, { workoutId, activityId });
      if (!subject.allowed) {
        res.status(subject.notFound ? 404 : 403).json({
          error: subject.notFound ? 'Workout or activity not found.' : 'Not allowed to read this discussion.',
        });
        return;
      }

      const { data, error } = await admin
        .from('workout_comments')
        .select(COMMENT_COLUMNS)
        .match(subject.match)
        .order('created_at', { ascending: true });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const comments = await withAuthorNames(admin, data || []);
      res.status(200).json({ comments, viewer_role: subject.senderRole });
      return;
    }

    if (req.method === 'POST') {
      const { workoutId, activityId, error: subjectError } = parseSubject(req.body || {});
      if (subjectError) {
        res.status(400).json({ error: subjectError });
        return;
      }

      const { body, error: bodyError } = validateCommentBody(req.body?.body);
      if (bodyError) {
        res.status(400).json({ error: bodyError });
        return;
      }

      const subject = await resolveSubject(admin, sessionAthleteId, { workoutId, activityId });
      if (!subject.allowed) {
        res.status(subject.notFound ? 404 : 403).json({
          error: subject.notFound ? 'Workout or activity not found.' : 'Not allowed to comment here.',
        });
        return;
      }

      // The coach party to the thread: the caller's own profile when a coach
      // writes, otherwise whichever coach the athlete works with. Recording it
      // on every row keeps the comment self-describing and gives the athlete's
      // reply somewhere to notify.
      const coachId = subject.senderRole === 'coach'
        ? subject.coachId
        : await resolveNotifyCoachId(admin, subject);

      const { data, error } = await admin
        .from('workout_comments')
        .insert({
          ...subject.match,
          athlete_id: subject.ownerAthleteId,
          coach_id: coachId || null,
          author_athlete_id: sessionAthleteId,
          sender_role: subject.senderRole,
          body,
        })
        .select(COMMENT_COLUMNS)
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      // Notifying the coach is a side effect of the conversation, not part of
      // it: a failure here must not lose the athlete's comment.
      if (subject.senderRole === 'athlete' && coachId) {
        const { error: notifyError } = await admin.from('coach_notifications').insert({
          coach_id: coachId,
          athlete_id: subject.ownerAthleteId,
          notification_type: 'workout_comment',
          title: workoutId ? 'New workout comment' : 'New activity comment',
          body: body.slice(0, 240),
          entity_type: workoutId ? 'planned_workout' : 'activity',
          entity_id: workoutId || activityId,
        });
        if (notifyError) {
          console.error('[workout-comments] coach notification failed:', notifyError.message);
        }
      }

      const [comment] = await withAuthorNames(admin, [data]);
      res.status(200).json({ comment });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[workout-comments] failed:', error);
    res.status(500).json({ error: error.message });
  }
}
