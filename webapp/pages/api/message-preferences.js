import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';
import { messageActor, messagingFailure } from '../../lib/messagingServer.js';

export function createMessagePreferencesHandler({ getClient = getSupabaseAdminClient,
  emailAvailable = () => Boolean(process.env.RESEND_API_KEY && process.env.MESSAGE_EMAIL_WORKER_SECRET?.length>=32) } = {}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','private, no-store');
    if (!['GET','PUT'].includes(req.method)) {res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'Method not allowed.'});}
    try {
      if(req.method==='PUT' && !requireSameOriginJson(req,res,'PUT')) return;
      const admin=getClient();const actor=await messageActor(req,admin);
      if(!actor)return res.status(401).json({error:'Not authenticated.'});
      if(req.method==='GET') {
        const {data,error}=await admin.from('message_preferences').select('email_enabled, badge_enabled').eq('athlete_id',actor.id).maybeSingle();
        if(error)throw error;
        return res.status(200).json({preferences:data || {email_enabled:false,badge_enabled:true},email_available:emailAvailable()});
      }
      const {email_enabled,badge_enabled}=req.body || {};
      if(typeof email_enabled!=='boolean' || typeof badge_enabled!=='boolean')return res.status(400).json({error:'Choose your message notification preferences.'});
      if(email_enabled && !emailAvailable())return res.status(503).json({error:'Email notifications are currently unavailable.'});
      const {data,error}=await admin.from('message_preferences').upsert({athlete_id:actor.id,email_enabled,badge_enabled,updated_at:new Date().toISOString()})
        .select('email_enabled, badge_enabled').single();
      if(error)throw error;
      return res.status(200).json({preferences:data,email_available:emailAvailable()});
    }catch(error){return messagingFailure(res,error);}
  };
}
export default createMessagePreferencesHandler();
