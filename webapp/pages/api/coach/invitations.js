import { getSupabaseAdminClient } from '../../../lib/authServer';
import { buildCoachSeatSnapshot, assertCoachSeatAvailable, coachSubscriptionHasAccess } from '../../../lib/coachBilling';
import {
  buildCoachInviteUrl,
  createInviteToken,
  getAuthenticatedAthlete,
  getCoachProfileByAthleteId,
} from '../../../lib/coachServer';
import { sendCoachInviteEmail } from '../../../lib/emailServer';

async function ensureCoachInviteAccess(req, res) {
  const athlete = await getAuthenticatedAthlete(req);
  if (!athlete) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }

  const admin = getSupabaseAdminClient();
  const profile = await getCoachProfileByAthleteId(admin, athlete.id);
  if (!profile) {
    res.status(404).json({ error: 'Coach profile not found.' });
    return null;
  }

  if (!profile || !coachSubscriptionHasAccess(profile)) {
    res.status(403).json({ error: 'Coach subscription required before sending invites.' });
    return null;
  }

  return { athlete, admin, profile };
}

export default async function handler(req, res) {
  const context = await ensureCoachInviteAccess(req, res);
  if (!context) return;

  const { athlete, admin, profile } = context;

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('coach_invitations')
      .select('id, email, token, status, expires_at, created_at, accepted_at')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[coach/invitations] list failed:', error);
      res.status(500).json({ error: 'Could not load invitations.' });
      return;
    }

    res.status(200).json({
      invitations: (data || []).map((invite) => ({
        ...invite,
        invite_url: buildCoachInviteUrl(invite.token, req),
      })),
    });
    return;
  }

  if (req.method === 'POST') {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }

    try {
      await assertCoachSeatAvailable(admin, profile);
    } catch (error) {
      const seatSnapshot = error.seatSnapshot || await buildCoachSeatSnapshot(admin, profile);
      res.status(error.statusCode || 409).json({
        error: error.message || 'Coach seat limit reached.',
        seatSnapshot,
      });
      return;
    }

    async function buildInviteResponse(invitation, statusCode) {
      const inviteUrl = buildCoachInviteUrl(invitation.token, req);
      let emailDelivery = { sent: false, skipped: false, error: null };

      try {
        const result = await sendCoachInviteEmail({
          to: invitation.email,
          coachName: profile.display_name || athlete.name || 'Your coach',
          inviteUrl,
          req,
        });
        emailDelivery = {
          sent: Boolean(result.ok),
          skipped: Boolean(result.skipped),
          error: result.ok || result.skipped ? null : result.error || 'Email was not sent.',
        };
      } catch (error) {
        console.error('[coach/invitations] email send failed:', error);
        emailDelivery = {
          sent: false,
          skipped: false,
          error: 'Invitation created, but the email could not be delivered.',
        };
      }

      res.status(statusCode).json({
        invitation,
        inviteUrl,
        emailDelivery,
      });
    }

    const { data: existingPending } = await admin
      .from('coach_invitations')
      .select('id, email, token, status, expires_at, created_at, accepted_at')
      .eq('coach_id', profile.id)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPending) {
      await buildInviteResponse(existingPending, 200);
      return;
    }

    const token = createInviteToken();
    const { data, error } = await admin
      .from('coach_invitations')
      .insert({
        coach_id: profile.id,
        email,
        token,
        created_by_athlete_id: athlete.id,
      })
      .select('id, email, token, status, expires_at, created_at, accepted_at')
      .single();

    if (error) {
      console.error('[coach/invitations] create failed:', error);
      res.status(500).json({ error: 'Could not create invitation.' });
      return;
    }

    await buildInviteResponse(data, 201);
    return;
  }

  if (req.method === 'PATCH') {
    const id = String(req.body?.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Invitation id is required.' });
      return;
    }

    const { data, error } = await admin
      .from('coach_invitations')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('coach_id', profile.id)
      .select('id, email, token, status, expires_at, created_at, accepted_at')
      .single();

    if (error) {
      console.error('[coach/invitations] revoke failed:', error);
      res.status(500).json({ error: 'Could not revoke invitation.' });
      return;
    }

    res.status(200).json({ invitation: data });
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
}
