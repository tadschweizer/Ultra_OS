import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';
import { getEffectiveAthleteIdFromRequest } from '../../lib/auth/requireAthlete.js';
import { groupComments, parseSubject, subjectKey } from '../../lib/workoutComments.js';
import { activityDateKey, normalizeSport } from '../../lib/workoutCompliance';

/**
 * Message center summary + read-state endpoint.
 *
 * Aggregates the two coach↔athlete channels into one payload the header
 * popup can render:
 *   - direct conversations (coach_messages)
 *   - per-session discussions (workout_comments), where a session is either a
 *     planned workout or an imported activity
 * and exposes mark-read actions for both.
 */

const COMMENT_COLUMNS = 'id, planned_workout_id, activity_id, athlete_id, sender_role, body, created_at, read_at';

async function getCoachProfile(admin, athleteId) {
  const { data } = await admin
    .from('coach_profiles')
    .select('id, display_name')
    .eq('athlete_id', athleteId)
    .maybeSingle();
  return data || null;
}

/**
 * Resolves the title, date, and sport behind each thread.
 *
 * The two subject kinds live in different tables, so this costs one batched
 * read per kind no matter how the threads are mixed.
 *
 * @param {Array<{ subject_type: string, subject_id: string }>} threads
 * @returns {Promise<Map<string, { title: string, date: string|null, sport: string|null }>>}
 */
async function resolveThreadSubjects(admin, threads) {
  const idsOfType = (type) => threads.filter((t) => t.subject_type === type).map((t) => t.subject_id);
  const workoutIds = idsOfType('workout');
  const activityIds = idsOfType('activity');

  const [workoutRes, activityRes] = await Promise.all([
    workoutIds.length
      ? admin.from('planned_workouts').select('id, title, sport, workout_date').in('id', workoutIds)
      : Promise.resolve({ data: [] }),
    activityIds.length
      ? admin.from('strava_activities').select('id, name, sport_type, local_date, start_date').in('id', activityIds)
      : Promise.resolve({ data: [] }),
  ]);

  const subjects = new Map();
  (workoutRes.data || []).forEach((workout) => {
    subjects.set(subjectKey('workout', workout.id), {
      title: workout.title || 'Workout',
      date: workout.workout_date || null,
      sport: workout.sport || null,
    });
  });
  (activityRes.data || []).forEach((activity) => {
    subjects.set(subjectKey('activity', activity.id), {
      title: activity.name || 'Imported activity',
      date: activityDateKey(activity),
      sport: normalizeSport(activity.sport_type) || 'other',
    });
  });
  return subjects;
}

/** Flattens a grouped thread plus its resolved subject into the client shape. */
function toThreadPayload(thread, subject, { athleteId, name, unreadFrom }) {
  return {
    subject_type: thread.subject_type,
    subject_id: thread.subject_id,
    title: subject?.title || (thread.subject_type === 'activity' ? 'Imported activity' : 'Workout'),
    date: subject?.date || null,
    sport: subject?.sport || null,
    athlete_id: athleteId,
    name,
    last_comment: thread.comments[0] || null,
    unread: thread.comments.filter((c) => c.sender_role === unreadFrom && !c.read_at).length,
  };
}

function byNewestComment(a, b) {
  return new Date(b.last_comment?.created_at || 0) - new Date(a.last_comment?.created_at || 0);
}

async function buildCoachSummary(admin, coachId) {
  const { data: relationships } = await admin
    .from('coach_athlete_relationships')
    .select('athlete_id, group_name')
    .eq('coach_id', coachId)
    .eq('status', 'active');
  const athleteIds = (relationships || []).map((r) => r.athlete_id);
  if (!athleteIds.length) {
    return { conversations: [], workout_threads: [], unread_total: 0 };
  }

  const [{ data: athletes }, { data: messages }, { data: comments }] = await Promise.all([
    admin.from('athletes').select('id, name, email').in('id', athleteIds),
    admin
      .from('coach_messages')
      .select('id, athlete_id, sender_role, message_body, created_at, read_at')
      .eq('coach_id', coachId)
      .in('athlete_id', athleteIds)
      .order('created_at', { ascending: false })
      .limit(300),
    admin
      .from('workout_comments')
      .select(COMMENT_COLUMNS)
      .in('athlete_id', athleteIds)
      .order('created_at', { ascending: false })
      .limit(120),
  ]);

  const athleteById = new Map((athletes || []).map((a) => [a.id, a]));

  const conversations = athleteIds.map((athleteId) => {
    const thread = (messages || []).filter((m) => m.athlete_id === athleteId);
    const unread = thread.filter((m) => m.sender_role === 'athlete' && !m.read_at).length;
    const athlete = athleteById.get(athleteId);
    return {
      athlete_id: athleteId,
      name: athlete?.name || athlete?.email || 'Athlete',
      last_message: thread[0] || null,
      unread,
    };
  }).sort((a, b) => new Date(b.last_message?.created_at || 0) - new Date(a.last_message?.created_at || 0));

  const threads = groupComments(comments || []);
  const subjects = await resolveThreadSubjects(admin, threads);

  const workout_threads = threads.map((thread) => {
    const athlete = athleteById.get(thread.athlete_id);
    return toThreadPayload(thread, subjects.get(thread.key), {
      athleteId: thread.athlete_id,
      name: athlete?.name || athlete?.email || 'Athlete',
      unreadFrom: 'athlete',
    });
  }).sort(byNewestComment);

  const unread_total = conversations.reduce((sum, c) => sum + c.unread, 0)
    + workout_threads.reduce((sum, t) => sum + t.unread, 0);
  return { conversations, workout_threads, unread_total };
}

async function buildAthleteSummary(admin, athleteId) {
  const { data: relationship } = await admin
    .from('coach_athlete_relationships')
    .select('coach_id')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  const coachId = relationship?.coach_id || null;

  let conversations = [];
  if (coachId) {
    const [{ data: coach }, { data: messages }] = await Promise.all([
      admin.from('coach_profiles').select('id, display_name').eq('id', coachId).maybeSingle(),
      admin
        .from('coach_messages')
        .select('id, athlete_id, sender_role, message_body, created_at, read_at')
        .eq('coach_id', coachId)
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    conversations = [{
      athlete_id: athleteId,
      name: coach?.display_name || 'Coach',
      last_message: messages?.[0] || null,
      unread: (messages || []).filter((m) => m.sender_role === 'coach' && !m.read_at).length,
    }];
  }

  const { data: comments } = await admin
    .from('workout_comments')
    .select(COMMENT_COLUMNS)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(120);

  const threads = groupComments(comments || []);
  const subjects = await resolveThreadSubjects(admin, threads);

  const workout_threads = threads.map((thread) => toThreadPayload(thread, subjects.get(thread.key), {
    athleteId,
    name: 'Coach',
    unreadFrom: 'coach',
  })).sort(byNewestComment);

  const unread_total = conversations.reduce((sum, c) => sum + c.unread, 0)
    + workout_threads.reduce((sum, t) => sum + t.unread, 0);
  return { conversations, workout_threads, unread_total, has_coach: Boolean(coachId) };
}

export default async function handler(req, res) {
  const sessionAthleteId = await getEffectiveAthleteIdFromRequest(req);
  if (!sessionAthleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    const coachProfile = await getCoachProfile(admin, sessionAthleteId);
    const role = coachProfile ? 'coach' : 'athlete';

    if (req.method === 'GET') {
      if (role === 'coach') {
        const summary = await buildCoachSummary(admin, coachProfile.id);
        res.status(200).json({ role, has_messaging: true, ...summary });
        return;
      }
      const summary = await buildAthleteSummary(admin, sessionAthleteId);
      res.status(200).json({
        role,
        has_messaging: summary.has_coach || summary.workout_threads.length > 0,
        ...summary,
      });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action !== 'mark_read') {
        res.status(400).json({ error: 'Unsupported action.' });
        return;
      }

      if (body.scope === 'conversation') {
        if (role === 'coach') {
          if (!body.athlete_id) {
            res.status(400).json({ error: 'athlete_id is required.' });
            return;
          }
          await admin
            .from('coach_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('coach_id', coachProfile.id)
            .eq('athlete_id', body.athlete_id)
            .eq('sender_role', 'athlete')
            .is('read_at', null);
        } else {
          await admin
            .from('coach_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('athlete_id', sessionAthleteId)
            .eq('sender_role', 'coach')
            .is('read_at', null);
        }
        res.status(200).json({ success: true });
        return;
      }

      // Scope name is historical: a session thread hangs off a planned workout
      // or an imported activity, and the body names whichever one it is.
      if (body.scope === 'workout') {
        const { workoutId, activityId, error: subjectError } = parseSubject(body);
        if (subjectError) {
          res.status(400).json({ error: subjectError });
          return;
        }

        // Verify access to the subject before touching read state.
        const { data: subject } = workoutId
          ? await admin.from('planned_workouts').select('id, athlete_id').eq('id', workoutId).maybeSingle()
          : await admin.from('strava_activities').select('id, athlete_id').eq('id', activityId).maybeSingle();
        if (!subject) {
          res.status(404).json({ error: 'Workout or activity not found.' });
          return;
        }
        if (role === 'coach') {
          const { data: relationship } = await admin
            .from('coach_athlete_relationships')
            .select('id')
            .eq('coach_id', coachProfile.id)
            .eq('athlete_id', subject.athlete_id)
            .eq('status', 'active')
            .maybeSingle();
          if (!relationship) {
            res.status(403).json({ error: 'Not allowed.' });
            return;
          }
        } else if (subject.athlete_id !== sessionAthleteId) {
          res.status(403).json({ error: 'Not allowed.' });
          return;
        }
        await admin
          .from('workout_comments')
          .update({ read_at: new Date().toISOString() })
          .match(workoutId ? { planned_workout_id: workoutId } : { activity_id: activityId })
          .eq('sender_role', role === 'coach' ? 'athlete' : 'coach')
          .is('read_at', null);
        res.status(200).json({ success: true });
        return;
      }

      res.status(400).json({ error: 'Unsupported scope.' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[message-center] failed:', error);
    res.status(500).json({ error: error.message });
  }
}
