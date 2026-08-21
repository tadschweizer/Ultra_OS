import { generateCoachCode } from '../../../lib/coachProtocols.js';
import { getSiteUrl, sendCoachInvitationEmail } from '../../../lib/email/transactional.js';

const INVITATION_FIELDS = [
  'id',
  'email',
  'token',
  'status',
  'expires_at',
  'accepted_at',
  'created_at',
  'delivery_status',
  'delivery_attempted_at',
  'delivery_sent_at',
  'delivery_failure_category',
].join(', ');

function deliveryRecord(delivery, attemptedAt) {
  if (delivery?.ok && !delivery.skipped) {
    return {
      delivery_status: 'sent',
      delivery_attempted_at: attemptedAt,
      delivery_sent_at: attemptedAt,
      delivery_failure_category: null,
    };
  }
  if (delivery?.skipped) {
    return {
      delivery_status: 'skipped',
      delivery_attempted_at: attemptedAt,
      delivery_sent_at: null,
      delivery_failure_category: 'not_configured',
    };
  }
  return {
    delivery_status: 'failed',
    delivery_attempted_at: attemptedAt,
    delivery_sent_at: null,
    delivery_failure_category: delivery?.failureCategory || 'provider_error',
  };
}

async function ensureCoachProfile(admin, athleteId) {
  const { data: athlete } = await admin
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();

  const { data: existing } = await admin
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await admin
    .from('coach_profiles')
    .insert({
      athlete_id: athleteId,
      display_name: athlete?.name || 'Coach',
      coach_code: generateCoachCode(athlete?.name || 'Coach'),
    })
    .select('id, athlete_id, display_name, coach_code')
    .single();

  if (error) throw error;
  return data;
}

export async function handleCoachInvitations(req, res, {
  admin,
  athleteIdResolver,
  emailSender = sendCoachInvitationEmail,
  siteUrl = getSiteUrl(),
  now = new Date(),
  tokenGenerator = () => crypto.randomUUID(),
} = {}) {
  if (!admin) throw new Error('Coach invitations handler requires an admin database client.');
  if (!athleteIdResolver) throw new Error('Coach invitations handler requires an athlete resolver.');

  const athleteId = await athleteIdResolver(req, admin);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(admin, athleteId);

    // ── GET: list all invitations for this coach ────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('coach_invitations')
        .select(INVITATION_FIELDS)
        .eq('coach_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ invitations: data || [], profile });
      return;
    }

    // ── POST: create a new invitation ───────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.email) { res.status(400).json({ error: 'email is required' }); return; }

      const expiresInHours = typeof body.expires_in_hours === 'number' ? body.expires_in_hours : 72;
      const expiresAt = new Date(now.getTime() + expiresInHours * 3600 * 1000).toISOString();
      const token = tokenGenerator();

      const { data, error } = await admin
        .from('coach_invitations')
        .insert({
          coach_id: profile.id,
          email: body.email.trim().toLowerCase(),
          token,
          status: 'pending',
          expires_at: expiresAt,
          delivery_status: 'pending',
        })
        .select(INVITATION_FIELDS)
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }

      const inviteUrl = `${siteUrl.replace(/\/$/, '')}/join?coach_invite=${encodeURIComponent(token)}`;
      const delivery = await emailSender({
        coachName: profile.display_name,
        email: data.email,
        inviteUrl,
        expiresAt: data.expires_at,
      });
      const attemptedAt = now.toISOString();
      const persistedDelivery = deliveryRecord(delivery, attemptedAt);
      const { data: persistedInvitation, error: persistError } = await admin
        .from('coach_invitations')
        .update(persistedDelivery)
        .eq('id', data.id)
        .eq('coach_id', profile.id)
        .select(INVITATION_FIELDS)
        .single();

      if (persistError || !persistedInvitation) {
        console.error('[coach invitation] could not persist email delivery state', {
          invitationId: data.id,
          deliveryStatus: persistedDelivery.delivery_status,
        });
        res.status(500).json({
          error: 'Invitation created, but its email delivery result could not be recorded. Copy the invitation link instead.',
          invitation: data,
          profile,
          invite_url: inviteUrl,
          delivery_status: 'unknown',
        });
        return;
      }

      if (persistedDelivery.delivery_status !== 'sent') {
        console.error('[coach invitation] email was not delivered', {
          invitationId: data.id,
          deliveryStatus: persistedDelivery.delivery_status,
          failureCategory: persistedDelivery.delivery_failure_category,
        });
        res.status(502).json({
          error: persistedDelivery.delivery_status === 'skipped'
            ? 'Invitation created, but email delivery is not configured. Copy the invitation link instead.'
            : 'Invitation created, but the email could not be delivered. Copy the invitation link instead.',
          invitation: persistedInvitation,
          profile,
          invite_url: inviteUrl,
          delivery_status: persistedDelivery.delivery_status,
        });
        return;
      }

      res.status(200).json({
        invitation: persistedInvitation,
        profile,
        invite_url: inviteUrl,
        delivery_status: 'sent',
      });
      return;
    }

    // ── PATCH: revoke an invitation ─────────────────────────────────────────
    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (!body.id) { res.status(400).json({ error: 'id is required' }); return; }

      const updates = {};
      if (body.status !== undefined) updates.status = body.status;

      const { data, error } = await admin
        .from('coach_invitations')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ invitation: data });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export default async function handler(req, res) {
  const [{ getSupabaseAdminClient }, { getEffectiveAthleteIdFromRequest }] = await Promise.all([
    import('../../../lib/authServer.js'),
    import('../../../lib/auth/requireAthlete.js'),
  ]);

  await handleCoachInvitations(req, res, {
    admin: getSupabaseAdminClient(),
    athleteIdResolver: getEffectiveAthleteIdFromRequest,
  });
}
