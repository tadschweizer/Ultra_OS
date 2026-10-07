import { validMessageId } from '../../lib/directMessages.js';
import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { loadMessagingSummary, inboxConversations } from '../../lib/messagingSummary.js';
import { getEffectiveAthleteIdFromRequest } from '../../lib/auth/requireAthlete.js';
import { parseSubject } from '../../lib/workoutComments.js';
import { loadAccountAccess } from '../../lib/auth/roleAccessServer.js';
import { resolveAccountMode } from '../../lib/auth/roleGuards.js';

export function createMessageCenterHandler({ getAdmin = getSupabaseAdminClient, getActor = getEffectiveAthleteIdFromRequest } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    const admin = getAdmin();
    const sessionAthleteId = await getActor(req, admin);
    if (!sessionAthleteId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }


    try {
      const access = await loadAccountAccess(admin, sessionAthleteId);
      const requestedMode = req.method === 'GET' ? req.query.mode : req.body?.mode;
      const role = resolveAccountMode(access, requestedMode);
      const coachProfile = role === 'coach' && access?.capabilities.coach
        ? access.coachProfile
        : null;

      if (req.method === 'GET') {
        const summary = await loadMessagingSummary(admin, sessionAthleteId, role);
        return res.status(200).json({ role, ...summary });
      }

      if (req.method === 'POST') {
        const body = req.body || {};
        if (body.action !== 'mark_read') {
          res.status(400).json({ error: 'Unsupported action.' });
          return;
        }

        if (body.scope === 'conversation') {
          const ids = body.message_ids;
          if (!Array.isArray(ids) || !ids.length || ids.length > 50 || !ids.every(validMessageId)) {
            return res.status(400).json({ error: 'Provide the messages you have read.' });
          }
          const athleteId = role === 'coach' ? body.athlete_id : sessionAthleteId;
          if (!validMessageId(athleteId)) return res.status(400).json({ error: 'Invalid athlete.' });
          let relation = admin.from('coach_athlete_relationships').select('coach_id')
            .eq('athlete_id', athleteId).eq('status', 'active');
          if (role === 'coach') relation = relation.eq('coach_id', coachProfile.id);
          const { data: relationship, error: relationshipError } = await relation.order('coach_id', { ascending: true }).limit(1).maybeSingle();
          if (relationshipError) throw relationshipError;
          if (!relationship) return res.status(403).json({ error: 'No active coaching relationship.' });
          const { error } = await admin.from('coach_messages')
            .update({ read_at: new Date().toISOString() }).eq('coach_id', relationship.coach_id)
            .eq('athlete_id', athleteId).eq('sender_role', role === 'coach' ? 'athlete' : 'coach')
            .in('id', ids).is('read_at', null);
          if (error) throw error;
          const summary = await loadMessagingSummary(admin, sessionAthleteId, role);
          return res.status(200).json({ success: true, conversations: inboxConversations(summary), unread_total: summary.unread_total });
        }

        // Scope name is historical: a session thread hangs off a planned workout
        // or an imported activity, and the body names whichever one it is.
        if (body.scope === 'workout') {
          const ids = body.comment_ids;
          if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every(validMessageId)) {
            return res.status(400).json({ error: 'Provide the comments you have read.' });
          }
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
          const { error: readError } = await admin
            .from('workout_comments')
            .update({ read_at: new Date().toISOString() })
            .in('id', ids)
            .eq('athlete_id', subject.athlete_id)
            .match(workoutId ? { planned_workout_id: workoutId } : { activity_id: activityId })
            .eq('sender_role', role === 'coach' ? 'athlete' : 'coach')
            .is('read_at', null);
          if (readError) throw readError;
          res.status(200).json({ success: true });
          return;
        }

        res.status(400).json({ error: 'Unsupported scope.' });
        return;
      }

      res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('[message-center] failed:', error);
      res.status(500).json({ error: 'Could not update messages. Please try again.' });
    }
  }
}
export default createMessageCenterHandler();
