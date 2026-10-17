import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { messageActor } from '../../../lib/messagingServer.js';
import { isActiveCoachingRelationship } from '../../../lib/pilotEntitlements.js';
import { requireSameOriginJson } from '../../../lib/billingSecurity.js';
import { validateWorkoutFields, validWorkoutRequestId } from '../../../lib/workoutValidation.js';
import { validateWeek, dateAfter } from '../../../lib/weeklyPlan.js';
import { loadCoachEntitlement } from '../../../lib/pilotEntitlementsServer.js';

async function activeRelationship(admin,coach,athlete) {
  const {data,error}=await admin.from('coach_athlete_relationships').select('status,removed_at,expires_at').eq('coach_id',coach).eq('athlete_id',athlete).eq('status','active').maybeSingle();
  if(error)throw error;return isActiveCoachingRelationship(data);
}

export function createWeeklyPlanHandler({ getAdmin = getSupabaseAdminClient, actorFor = messageActor } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
    if (req.method === 'POST' && !requireSameOriginJson(req,res)) return;
    try {
      const admin=getAdmin(), actor=await actorFor(req,admin);
      if (!actor) return res.status(401).json({error:'Sign in to plan training.'});
      if (actor.role!=='coach' || !actor.access.capabilities.coach) return res.status(403).json({error:'Coach access required.'});
      if(!(await loadCoachEntitlement(admin,actor.access.coachProfile,actor.access.athlete)).eligible)return res.status(403).json({error:'An active coach subscription or pilot grant is required.'});
      if (req.method==='GET') {
        const {athlete_id,week_start}=req.query;
        if (!validWorkoutRequestId(athlete_id) || !week_start || validateWorkoutFields({workout_date:week_start})) return res.status(400).json({error:'Choose an athlete and week.'});
        if (!await activeRelationship(admin,actor.access.coachProfile.id,athlete_id)) return res.status(403).json({error:'No active coaching relationship.'});
        const {data,error}=await admin.from('planned_workouts').select('*').eq('athlete_id',athlete_id)
          .gte('workout_date',week_start).lte('workout_date',dateAfter(week_start,6)).order('workout_date').order('order_index').limit(501);
        if(error) throw error;
        if(data.length>500)return res.status(400).json({error:'This week is too large for bulk planning.'});
        const visible=data.filter(w=>w.visibility==='athlete_visible'||w.coach_id===actor.access.coachProfile.id);
        return res.json({workouts:visible, sources:visible.filter(w=>w.coach_id===actor.access.coachProfile.id)});
      }
      const error=validateWeek(req.body||{}); if(error)return res.status(400).json({error});
      if (!await activeRelationship(admin,actor.access.coachProfile.id,req.body.athlete_id)) return res.status(403).json({error:'No active coaching relationship.'});
      const result=await admin.rpc('publish_coaching_week',{p_actor_id:actor.id,p_payload:req.body});
      if(result.error)throw result.error;
      return res.json(result.data);
    } catch(error) {
      const status=error.code==='42501'?403:error.code==='PT409'?409:error.code==='22023'?400:503;
      return res.status(status).json({error:status===409?'The source or destination changed. Refresh the preview before retrying.':status===403?'This coach no longer has access to the source or destination.':'Week publishing is unavailable. Keep this preview and retry; confirmed assignments will not be duplicated.'});
    }
  };
}
export default createWeeklyPlanHandler();
