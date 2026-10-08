import { validMessageId } from '../../lib/directMessages.js';
import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { parseSubject } from '../../lib/workoutComments.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';
import { messageActor, messageConversation, inboxSummary, messagingFailure } from '../../lib/messagingServer.js';
// Canonical resolveAccountMode is enforced by messageActor.

export function createMessageCenterHandler({ getClient = getSupabaseAdminClient } = {}) {
return async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
  try {
    if(req.method==='POST' && !requireSameOriginJson(req,res))return;
    const admin=getClient();const actor=await messageActor(req,admin,{preferCoach:false});
    if(!actor)return res.status(401).json({error:'Not authenticated.'});
    const sessionAthleteId=actor.id;const role=actor.role;const coachProfile=actor.access.coachProfile;
    if(req.method==='GET')return res.status(200).json({role,...await inboxSummary(admin,actor)});
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
        const relationship = await messageConversation(admin,actor,athleteId);
        if (!relationship) return res.status(403).json({ error: 'No active coaching relationship.' });
        const { error } = await admin.from('coach_messages')
          .update({ read_at: new Date().toISOString() }).eq('coach_id', relationship.coach_id)
          .eq('athlete_id', athleteId).eq('sender_role', role === 'coach' ? 'athlete' : 'coach')
          .in('id', ids).is('read_at', null);
        if (error) throw error;
        return res.status(200).json({ success: true });
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
        const { error: readError } = await admin
          .from('workout_comments')
          .update({ read_at: new Date().toISOString() })
          .match(workoutId ? { planned_workout_id: workoutId } : { activity_id: activityId })
          .eq('athlete_id', subject.athlete_id)
          .eq('sender_role', role === 'coach' ? 'athlete' : 'coach')
          .is('read_at', null);
        if (readError) throw readError;
        res.status(200).json({ success: true });
        return;
      }

      res.status(400).json({ error: 'Unsupported scope.' });
      return;
    }


  } catch(error) { return messagingFailure(res,error); }
};
}
export default createMessageCenterHandler();
