import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { messageActor } from '../../lib/messagingServer.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';
import { validWorkoutRequestId } from '../../lib/workoutValidation.js';
import { loadCoachEntitlement } from '../../lib/pilotEntitlementsServer.js';

export function createWorkoutReviewHandler({ getAdmin=getSupabaseAdminClient, actorFor=messageActor }={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
    if(req.method==='POST'&&!requireSameOriginJson(req,res))return;
    try {
      const admin=getAdmin(), actor=await actorFor(req,admin,{preferCoach:false});
      if(!actor)return res.status(401).json({error:'Sign in to review training.'});
      const body=req.method==='GET'?req.query:req.body||{};
      if(req.method==='GET'&&!body.workout_id){
        if(actor.role!=='coach'||!actor.access.capabilities.coach)return res.status(403).json({error:'Coach access required.'});
        if(!(await loadCoachEntitlement(admin,actor.access.coachProfile,actor.access.athlete)).eligible)return res.status(403).json({error:'An active coach subscription or pilot grant is required.'});
        const page=Number(body.page||0);if(!Number.isInteger(page)||page<0||page>10000)return res.status(400).json({error:'Invalid page.'});
        const {data,error}=await admin.rpc('coaching_review_queue',{p_actor_id:actor.id,p_offset:page*50});
        if(error)throw error;return res.json(data);
      }
      if(!validWorkoutRequestId(body.workout_id))return res.status(400).json({error:'Invalid workout.'});
      if(req.method==='POST'&&(!validWorkoutRequestId(body.request_id)||!['request','review','reply'].includes(body.action)||!Number.isSafeInteger(body.revision)||body.revision<0))return res.status(400).json({error:'Refresh this workout before saving.'});
      if(req.method==='POST'&&body.action!=='request'&&!actor.access.capabilities.coach)return res.status(403).json({error:'Coach access required.'});
      if(req.method==='POST'&&body.action!=='request'&&!(await loadCoachEntitlement(admin,actor.access.coachProfile,actor.access.athlete)).eligible)return res.status(403).json({error:'An active coach subscription or pilot grant is required.'});
      const {data,error}=await admin.rpc('coaching_workout_review',{p_actor_id:actor.id,p_workout_id:body.workout_id,
        p_action:req.method==='GET'?'get':body.action,p_revision:body.revision??null,p_reply:body.reply??null,p_request_id:body.request_id??null});
      if(error)throw error;return res.json(data);
    } catch(error){
      const status=error.code==='PT409'?409:error.code==='42501'?403:error.code==='22023'?400:503;
      return res.status(status).json({error:status===409?'New feedback arrived or this action already saved. Refresh the review before retrying.':status===403?'Review requires a published workout and its active assigning coach.':'Review is unavailable. Your draft is preserved; retry after refreshing.'});
    }
  };
}
export default createWorkoutReviewHandler();
