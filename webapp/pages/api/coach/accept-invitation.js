import { assertAuthPostMethod } from '../../../lib/auth/contracts.js';

function respondError(res, status, code, error, extra = {}) {
  res.status(status).json({ code, error, ...extra });
}

async function loadInvitation(admin, token) {
  const { data, error } = await admin
    .from('coach_invitations')
    .select('id, coach_id, email, status, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();
  return error ? null : data;
}

async function loadCoach(admin, coachId) {
  const { data } = await admin
    .from('coach_profiles')
    .select('id, athlete_id, display_name')
    .eq('id', coachId)
    .maybeSingle();
  return data || null;
}

async function hasActiveRelationship(admin, coachId, athleteId) {
  if (!athleteId) return false;
  const { data } = await admin
    .from('coach_athlete_relationships')
    .select('id')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data);
}

async function previewInvitation(req, res, admin, effectiveAthleteResolver, nowMs) {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) {
    respondError(res, 400, 'invalid', 'An invitation token is required.');
    return;
  }

  const invitation = await loadInvitation(admin, token);
  if (!invitation) {
    respondError(res, 404, 'invalid', 'That invitation link is not valid.');
    return;
  }

  const coach = await loadCoach(admin, invitation.coach_id);
  if (!coach) {
    respondError(res, 404, 'invalid', 'That coach account no longer exists.');
    return;
  }

  if (invitation.status === 'pending' && new Date(invitation.expires_at).getTime() <= nowMs) {
    await admin.from('coach_invitations').update({ status: 'expired' }).eq('id', invitation.id);
    invitation.status = 'expired';
  }

  const coachResponse = { coach: { id: coach.id, display_name: coach.display_name } };
  if (invitation.status === 'expired') {
    respondError(res, 410, 'expired', 'That invitation has expired. Ask your coach to send a new one.', {
      ...coachResponse,
      expires_at: invitation.expires_at,
    });
    return;
  }
  if (invitation.status === 'accepted') {
    const { athleteId } = await effectiveAthleteResolver(req, admin);
    const alreadyAccepted = await hasActiveRelationship(admin, invitation.coach_id, athleteId);
    respondError(
      res,
      409,
      alreadyAccepted ? 'already_accepted' : 'used',
      alreadyAccepted ? `You are already connected to ${coach.display_name}.` : 'That invitation has already been used.',
      coachResponse
    );
    return;
  }
  if (invitation.status !== 'pending') {
    respondError(res, 409, 'used', 'That invitation is no longer available.', coachResponse);
    return;
  }

  res.status(200).json({
    status: 'pending',
    ...coachResponse,
    expires_at: invitation.expires_at,
  });
}

async function acceptInvitation(req, res, admin, liveAthleteResolver, nowDate) {
  if (!assertAuthPostMethod(req, res)) return;
  const athleteId = await liveAthleteResolver(req, res, admin);
  if (!athleteId) return;

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    respondError(res, 400, 'invalid', 'An invitation token is required.');
    return;
  }

  const invitation = await loadInvitation(admin, token);
  if (!invitation) {
    respondError(res, 404, 'invalid', 'That invitation link is not valid.');
    return;
  }
  const coachProfile = await loadCoach(admin, invitation.coach_id);
  if (!coachProfile) {
    respondError(res, 404, 'invalid', 'That coach account no longer exists.');
    return;
  }

  if (invitation.status === 'accepted') {
    if (await hasActiveRelationship(admin, invitation.coach_id, athleteId)) {
      res.status(200).json({
        ok: true,
        already_accepted: true,
        coach: { id: coachProfile.id, display_name: coachProfile.display_name },
      });
      return;
    }
    respondError(res, 409, 'used', 'That invitation has already been used.');
    return;
  }
  if (invitation.status !== 'pending') {
    respondError(res, 409, 'used', 'That invitation is no longer available.');
    return;
  }
  if (new Date(invitation.expires_at).getTime() <= nowDate.getTime()) {
    await admin.from('coach_invitations').update({ status: 'expired' }).eq('id', invitation.id);
    respondError(res, 410, 'expired', 'That invitation has expired. Ask your coach to send a new one.');
    return;
  }

  const { data: athlete, error: athleteError } = await admin
    .from('athletes')
    .select('id, email')
    .eq('id', athleteId)
    .maybeSingle();
  if (athleteError || !athlete) {
    respondError(res, 500, 'error', 'Could not load your account.');
    return;
  }
  if ((athlete.email || '').toLowerCase() !== invitation.email.toLowerCase()) {
    respondError(res, 403, 'wrong_account', 'This invitation was sent to a different email address. Log in with that account to accept it.');
    return;
  }
  if (coachProfile.athlete_id === athleteId) {
    respondError(res, 400, 'invalid', 'You cannot accept your own invitation.');
    return;
  }

  const now = nowDate.toISOString();
  const { error: relationshipError } = await admin
    .from('coach_athlete_relationships')
    .upsert({
      coach_id: invitation.coach_id,
      athlete_id: athleteId,
      status: 'active',
      accepted_at: now,
      removed_at: null,
      initiated_by: 'coach',
    }, { onConflict: 'coach_id,athlete_id' });
  if (relationshipError) {
    respondError(res, 500, 'error', 'Could not connect your account. Please try again.');
    return;
  }

  const { data: existingLink, error: linkLookupError } = await admin
    .from('coach_athlete_links')
    .select('id, role')
    .eq('athlete_id', athleteId)
    .eq('coach_id', invitation.coach_id)
    .maybeSingle();
  if (linkLookupError) {
    respondError(res, 500, 'error', 'Could not update your coach list. Please try again.');
    return;
  }

  let linkError = null;
  if (existingLink) {
    ({ error: linkError } = await admin.from('coach_athlete_links').update({ status: 'active' }).eq('id', existingLink.id));
  } else {
    const { data: primaryTaken, error: primaryError } = await admin
      .from('coach_athlete_links')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('role', 'primary')
      .eq('status', 'active')
      .maybeSingle();
    if (primaryError) {
      respondError(res, 500, 'error', 'Could not update your coach list. Please try again.');
      return;
    }
    ({ error: linkError } = await admin.from('coach_athlete_links').insert({
      athlete_id: athleteId,
      coach_id: invitation.coach_id,
      role: primaryTaken ? 'secondary' : 'primary',
      status: 'active',
    }));
  }
  if (linkError) {
    respondError(res, 500, 'error', 'Could not update your coach list. Please try again.');
    return;
  }

  const { data: closedInvitation, error: closeError } = await admin
    .from('coach_invitations')
    .update({ status: 'accepted', accepted_at: now })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (closeError || !closedInvitation) {
    respondError(res, 500, 'error', 'Your accounts were connected, but the invitation could not be closed. Please refresh.');
    return;
  }

  res.status(200).json({
    ok: true,
    coach: { id: coachProfile.id, display_name: coachProfile.display_name },
  });
}

export async function handleCoachInvitation(req, res, {
  admin,
  liveAthleteResolver,
  effectiveAthleteResolver = async () => ({ athleteId: null }),
  now = new Date(),
} = {}) {
  if (!admin) throw new Error('Coach invitation handler requires an admin database client.');
  if (req.method === 'GET') {
    await previewInvitation(req, res, admin, effectiveAthleteResolver, now.getTime());
    return;
  }
  await acceptInvitation(req, res, admin, liveAthleteResolver, now);
}

export default async function handler(req, res) {
  const [{ getSupabaseAdminClient }, { requireLiveAthleteId, resolveEffectiveAthleteId }] = await Promise.all([
    import('../../../lib/authServer.js'),
    import('../../../lib/auth/requireAthlete.js'),
  ]);
  await handleCoachInvitation(req, res, {
    admin: getSupabaseAdminClient(),
    liveAthleteResolver: requireLiveAthleteId,
    effectiveAthleteResolver: resolveEffectiveAthleteId,
  });
}
