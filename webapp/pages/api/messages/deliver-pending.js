import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { sendMessageNotificationEmail } from '../../../lib/email/transactional.js';

export function createMessageEmailWorker({ getClient = getSupabaseAdminClient, send = sendMessageNotificationEmail,
  secret = () => process.env.MESSAGE_EMAIL_WORKER_SECRET } = {}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'});}
    const expected=secret();if(!expected || expected.length<32)return res.status(503).json({error:'Worker unavailable.'});
    const supplied=String(req.headers.authorization || '');const required=`Bearer ${expected}`;
    if(Buffer.byteLength(supplied)!==Buffer.byteLength(required) || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(required)))return res.status(401).json({error:'Not authenticated.'});
    try {
      const admin=getClient();let processed=0,sent=0,skipped=0;
      // Bound provider requests below the function duration limit.
      const deadline=Date.now()+40000;
      while(processed<10 && Date.now()<deadline) {
        const {data:job,error}=await admin.rpc('claim_message_email');if(error)throw error;if(!job)break;
        processed++;if(job.skipped){skipped++;continue;}
        let result;
        try {result=await send({email:job.email,messageId:job.message_id,mode:job.mode,athleteId:job.athlete_id});}
        catch {result={ok:false,failureCategory:'provider_unavailable'};}
        const failure=result.ok ? null : ['provider_unavailable','provider_rejected','unconfigured'].includes(result.failureCategory) ? result.failureCategory : 'provider_unavailable';
        const outcome=result.ok && !result.skipped ? 'sent' : failure==='provider_rejected' ? 'failed' : 'retry';
        const {data:finished,error:finishError}=await admin.rpc('finish_message_email',{p_message:job.message_id,p_lease:job.lease_token,
          p_outcome:outcome,p_provider:result.providerId || null,p_failure:failure});
        if(finishError || !finished)throw finishError || new Error('Lease changed');
        if(outcome==='sent')sent++;
      }
      return res.status(200).json({processed,sent,skipped});
    }catch {return res.status(503).json({error:'Delivery could not complete. Retry this job.'});}
  };
}
export const config={maxDuration:60};
export default createMessageEmailWorker();
