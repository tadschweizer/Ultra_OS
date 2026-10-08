import crypto from 'node:crypto';
import { loadMessagePage, parseMessageCursor, validMessageId } from '../../../lib/directMessages.js';
import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { requireSameOriginJson } from '../../../lib/billingSecurity.js';
import { messageActor, messageConversation, inboxSummary, messagingFailure } from '../../../lib/messagingServer.js';
// messageActor uses resolveAccountMode with canonical server-derived capabilities.

const MESSAGE_TEMPLATES = {
  missed_protocol_reminder: 'Quick check-in: I noticed a missed protocol session. Can you share what got in the way and your plan for the next session?',
  race_week_checkin: 'Race-week check-in: how is energy, sleep, and confidence today? Any adjustments needed?',
  gut_training_reminder: 'Reminder: keep gut training consistent this week. Log your intake and any symptoms after key sessions.',
  heat_block_reminder: 'Heat block reminder: prioritize hydration + sodium and log RPE/HR drift after sessions.',
  post_race_debrief_prompt: 'Great effort. When you can, send your post-race debrief: what went well, what to improve, and how recovery is going.',
  general_checkin: 'General check-in: how are you feeling this week and where do you need support?'
};


export function createCoachMessagesHandler({ getClient = getSupabaseAdminClient } = {}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','private, no-store');
    if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
    try {
      if(req.method==='POST' && !requireSameOriginJson(req,res))return;
      const admin=getClient();const actor=await messageActor(req,admin);
      if(!actor)return res.status(401).json({error:'Not authenticated.'});
      if(req.method==='GET') {
        try {parseMessageCursor(req.query.before);}catch{return res.status(400).json({error:'Invalid message cursor.'});}
        const summary=await inboxSummary(admin,actor);
        const athleteId=req.query.athlete_id || (actor.role==='athlete' ? actor.id : '');
        if(!athleteId)return res.status(200).json({messages:[],...summary,templates:MESSAGE_TEMPLATES,role:actor.role,actor_id:actor.id});
        const conversation=await messageConversation(admin,actor,athleteId);
        if(!conversation) {
          if(actor.role==='coach')return res.status(403).json({error:'No active coaching relationship.'});
          return res.status(200).json({messages:[],...summary,templates:MESSAGE_TEMPLATES,role:actor.role,actor_id:actor.id});
        }
        const page=await loadMessagePage(admin,conversation.coach_id,conversation.athlete_id,req.query.before);
        const ownIds = page.messages.filter(m => m.sender_role === actor.role).map(m => m.id);
        if (ownIds.length) {
          const {data:deliveries,error:deliveryError} = await admin.from('message_email_deliveries').select('message_id, status').in('message_id',ownIds);
          if (deliveryError) throw deliveryError;
          const byId = new Map((deliveries || []).map(d => [d.message_id,d.status]));
          page.messages = page.messages.map(m => m.sender_role === actor.role ? {...m,email_notification:byId.get(m.id) || null} : m);
        }
        return res.status(200).json({...page,...summary,templates:MESSAGE_TEMPLATES,role:actor.role,actor_id:actor.id});
      }
      const b=req.body || {};
      if(b.client_message_id!=null && !validMessageId(b.client_message_id))return res.status(400).json({error:'Invalid message retry key.'});
      if(b.message_body!=null && (typeof b.message_body!=='string' || b.message_body.length>5000))return res.status(400).json({error:'Messages must be 5,000 characters or fewer.'});
      if(b.template_key!=null && (typeof b.template_key!=='string' || !Object.hasOwn(MESSAGE_TEMPLATES,b.template_key)))return res.status(400).json({error:'Invalid message purpose.'});
      const conversation=await messageConversation(admin,actor,b.athlete_id);
      if(!conversation)return res.status(403).json({error:'No active coaching relationship.'});
      const text=(b.message_body || (actor.role==='coach' ? MESSAGE_TEMPLATES[b.template_key] : '') || '').trim();
      if(!text)return res.status(400).json({error:'Write a message before sending.'});
      const {data,error}=await admin.rpc('send_direct_message',{p_owner:actor.id,p_coach:conversation.coach_id,p_athlete:conversation.athlete_id,p_role:actor.role,
        p_body:text,p_template:actor.role==='coach' ? b.template_key || null : null,p_client_id:b.client_message_id || crypto.randomUUID()});
      if(error)throw error;
      return res.status(200).json(data);
    }catch(error){return messagingFailure(res,error);}
  };
}
export default createCoachMessagesHandler();
