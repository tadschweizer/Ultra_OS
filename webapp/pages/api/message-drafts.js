import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { requireSameOriginJson } from '../../lib/billingSecurity.js';
import { validMessageId } from '../../lib/directMessages.js';
import { messageActor, messageConversation, messagingFailure } from '../../lib/messagingServer.js';

export function createMessageDraftHandler({ getClient = getSupabaseAdminClient } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET','PUT'].includes(req.method)) { res.setHeader('Allow','GET, PUT'); return res.status(405).json({error:'Method not allowed.'}); }
    try {
      if (req.method === 'PUT' && !requireSameOriginJson(req,res,'PUT')) return;
      const admin = getClient(); const actor = await messageActor(req, admin);
      if (!actor) return res.status(401).json({error:'Not authenticated.'});
      const input = req.method === 'GET' ? req.query : req.body;
      const conversation = await messageConversation(admin,actor,input?.athlete_id);
      if (!conversation) return res.status(403).json({error:'No active coaching relationship.'});
      if (req.method === 'GET') {
        const { data, error } = await admin.from('message_drafts').select('body, template_key, client_message_id, version, updated_at')
          .eq('owner_id',actor.id).eq('coach_id',conversation.coach_id).eq('athlete_id',conversation.athlete_id).eq('sender_role',actor.role).maybeSingle();
        if (error) throw error;
        return res.status(200).json({draft:data || null});
      }
      const b = req.body || {};
      if (typeof b.body !== 'string' || b.body.length>5000 || (b.template_key != null && (typeof b.template_key !== 'string' || b.template_key.length>100))
        || (b.client_message_id != null && !validMessageId(b.client_message_id)) || (b.expected_version != null && !validMessageId(b.expected_version))) {
        return res.status(400).json({error:'Invalid draft.'});
      }
      const { data,error } = await admin.rpc('save_message_draft',{p_owner:actor.id,p_coach:conversation.coach_id,p_athlete:conversation.athlete_id,p_role:actor.role,
        p_body:b.body,p_template:actor.role==='coach' ? b.template_key || null : null,p_client_id:b.client_message_id || null,p_expected:b.expected_version || null});
      if (error) throw error;
      return res.status(200).json({draft:data});
    } catch(error) {return messagingFailure(res,error);}
  };
}
export default createMessageDraftHandler();
