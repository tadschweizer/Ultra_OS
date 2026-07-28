import { getSupabaseAdminClient } from '../../../lib/authServer';
import { canSendFollowup } from '../../../lib/importHealth';
import { getAthleteIdFromRequest } from '../../../lib/auth/sessionCookies.js';

// Coach tables are no longer reachable with the public anon key (RLS is on and
// the anon grants are revoked), so this route uses the service-role client.
// Authorisation is enforced in the handler from the session athlete id.
const supabase = getSupabaseAdminClient();

function buildFollowupBody(count) {
  return `Your TrainingPeaks import has ${count} workout${count === 1 ? '' : 's'} that need manual mapping. Open Connections → Migration completeness to finish them so your calendar and reports are complete.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const actorId = getAthleteIdFromRequest(req);
  if (!actorId) return res.status(401).json({ error: 'Not authenticated' });

  const jobId = req.body?.jobId;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('athlete_id', actorId)
      .maybeSingle();
    if (!coachProfile?.id) return res.status(403).json({ error: 'Coach profile not found' });

    const { data: job } = await supabase
      .from('trainingpeaks_import_jobs')
      .select('id, athlete_id, status, needs_manual_mapping_count, followup_sent_at')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return res.status(404).json({ error: 'Import job not found' });

    // The ACTIVE roster relationship authorizes — never job.coach_id, which is
    // null on athlete self-imports.
    const { data: relationship } = await supabase
      .from('coach_athlete_relationships')
      .select('id')
      .eq('coach_id', coachProfile.id)
      .eq('athlete_id', job.athlete_id)
      .eq('status', 'active')
      .maybeSingle();
    if (!relationship) return res.status(403).json({ error: 'Athlete is not in your active roster' });

    const eligibility = canSendFollowup(job);
    if (!eligibility.ok) {
      const status = job.followup_sent_at ? 409 : 400;
      return res.status(status).json({ error: eligibility.reason });
    }

    // Atomic idempotency claim: a plain read-then-write double-sends under
    // concurrent requests. Whoever flips followup_sent_at from null wins.
    const followupSentAt = new Date().toISOString();
    const { data: claimed } = await supabase
      .from('trainingpeaks_import_jobs')
      .update({ followup_sent_at: followupSentAt })
      .eq('id', jobId)
      .is('followup_sent_at', null)
      .select('id');
    if (!claimed?.length) return res.status(409).json({ error: 'Follow-up already sent.' });

    try {
      const { data: message, error: messageError } = await supabase
        .from('coach_messages')
        .insert({
          coach_id: coachProfile.id,
          athlete_id: job.athlete_id,
          sender_role: 'coach',
          message_body: buildFollowupBody(Number(job.needs_manual_mapping_count)),
          message_template_key: 'import_mapping_followup',
        })
        .select('id')
        .single();
      if (messageError) throw messageError;

      await supabase.from('coach_notifications').insert({
        coach_id: coachProfile.id,
        athlete_id: job.athlete_id,
        notification_type: 'import_followup_sent',
        title: 'Import mapping follow-up sent',
        body: `Asked the athlete to finish mapping ${job.needs_manual_mapping_count} imported items.`,
        entity_type: 'trainingpeaks_import_job',
        entity_id: jobId,
      });

      await supabase
        .from('trainingpeaks_import_jobs')
        .update({ followup_message_id: message.id })
        .eq('id', jobId);

      return res.status(200).json({ ok: true, followupSentAt, messageId: message.id });
    } catch (sendError) {
      // Release the claim so the coach can retry; a stuck "sent" state with no
      // message would silently drop the follow-up.
      console.error('import-followup: message send failed after claim, rolling back', sendError);
      await supabase
        .from('trainingpeaks_import_jobs')
        .update({ followup_sent_at: null, followup_message_id: null })
        .eq('id', jobId)
        .eq('followup_sent_at', followupSentAt);
      return res.status(500).json({ error: 'Could not send the follow-up message. Please try again.' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
