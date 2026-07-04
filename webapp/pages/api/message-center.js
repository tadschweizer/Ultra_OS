import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';

/**
 * Message center summary + read-state endpoint.
 *
 * Aggregates the two coach↔athlete channels into one payload the header
 * popup can render:
 *   - direct conversations (coach_messages)
 *   - per-workout discussions (workout_comments)
 * and exposes mark-read actions for both.
 */

async function getCoachProfile(admin, athleteId) {
  const { data } = await admin
    .from('coach_profiles')
    .select('id, display_name')
    .eq('athlete_id', athleteId)
    .maybeSingle();
  return data || null;
}

function groupComments(comments = []) {
  const threads = new Map();
  comments.forEach((comment) => {
    const key = comment.planned_workout_id;
    if (!threads.has(key)) {
      threads.set(key, { workout_id: key, athlete_id: comment.athlete_id, comments: [] });
    }
    threads.get(key).comments.push(comment);
  });
  return [...threads.values()];
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
      .select('id, planned_workout_id, athlete_id, sender_role, body, created_at, read_at')
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

  const workoutThreads = groupComments(comments || []);
  const workoutIds = workoutThreads.map((t) => t.workout_id);
  let workoutsById = new Map();
  if (workoutIds.length) {
    const { data: workoutRows } = await admin
      .from('planned_workouts')
      .select('id, title, sport, workout_date, athlete_id')
      .in('id', workoutIds);
    workoutsById = new Map((workoutRows || []).map((w) => [w.id, w]));
  }

  const workout_threads = workoutThreads.map((thread) => {
    const workout = workoutsById.get(thread.workout_id) || null;
    const athlete = athleteById.get(thread.athlete_id);
    return {
      workout_id: thread.workout_id,
      workout_title: workout?.title || 'Workout',
      workout_date: workout?.workout_date || null,
      sport: workout?.sport || null,
      athlete_id: thread.athlete_id,
      name: athlete?.name || athlete?.email || 'Athlete',
      last_comment: thread.comments[0] || null,
      unread: thread.comments.filter((c) => c.sender_role === 'athlete' && !c.read_at).length,
    };
  }).sort((a, b) => new Date(b.last_comment?.created_at || 0) - new Date(a.last_comment?.created_at || 0));

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
    .select('id, planned_workout_id, athlete_id, sender_role, body, created_at, read_at')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(120);

  const workoutThreads = groupComments(comments || []);
  const workoutIds = workoutThreads.map((t) => t.workout_id);
  let workoutsById = new Map();
  if (workoutIds.length) {
    const { data: workoutRows } = await admin
      .from('planned_workouts')
      .select('id, title, sport, workout_date')
      .in('id', workoutIds);
    workoutsById = new Map((workoutRows || []).map((w) => [w.id, w]));
  }

  const workout_threads = workoutThreads.map((thread) => {
    const workout = workoutsById.get(thread.workout_id) || null;
    return {
      workout_id: thread.workout_id,
      workout_title: workout?.title || 'Workout',
      workout_date: workout?.workout_date || null,
      sport: workout?.sport || null,
      athlete_id: athleteId,
      name: 'Coach',
      last_comment: thread.comments[0] || null,
      unread: thread.comments.filter((c) => c.sender_role === 'coach' && !c.read_at).length,
    };
  }).sort((a, b) => new Date(b.last_comment?.created_at || 0) - new Date(a.last_comment?.created_at || 0));

  const unread_total = conversations.reduce((sum, c) => sum + c.unread, 0)
    + workout_threads.reduce((sum, t) => sum + t.unread, 0);
  return { conversations, workout_threads, unread_total, has_coach: Boolean(coachId) };
}

export default async function handler(req, res) {
  const sessionAthleteId = getAthleteIdFromRequest(req);
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

      if (body.scope === 'workout') {
        if (!body.workout_id) {
          res.status(400).json({ error: 'workout_id is required.' });
          return;
        }
        // Verify access to the workout before touching read state.
        const { data: workout } = await admin
          .from('planned_workouts')
          .select('id, athlete_id')
          .eq('id', body.workout_id)
          .maybeSingle();
        if (!workout) {
          res.status(404).json({ error: 'Workout not found.' });
          return;
        }
        if (role === 'coach') {
          const { data: relationship } = await admin
            .from('coach_athlete_relationships')
            .select('id')
            .eq('coach_id', coachProfile.id)
            .eq('athlete_id', workout.athlete_id)
            .eq('status', 'active')
            .maybeSingle();
          if (!relationship) {
            res.status(403).json({ error: 'Not allowed.' });
            return;
          }
        } else if (workout.athlete_id !== sessionAthleteId) {
          res.status(403).json({ error: 'Not allowed.' });
          return;
        }
        await admin
          .from('workout_comments')
          .update({ read_at: new Date().toISOString() })
          .eq('planned_workout_id', body.workout_id)
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
