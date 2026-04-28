import { getSupabaseAdminClient } from '../../../../lib/authServer';
import { assertCoachSeatAvailable, coachSubscriptionHasAccess } from '../../../../lib/coachBilling';
import { getAuthenticatedAthlete } from '../../../../lib/coachServer';

async function loadInvite(admin, token) {
  const { data, error } = await admin
    .from('coach_invitations')
    .select('id, coach_id, email, token, status, expires_at, revoked_at, accepted_at, accepted_athlete_id, created_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function loadCoachProfile(admin, coachId) {
  const { data, error } = await admin
    .from('coach_profiles')
    .select('id, athlete_id, display_name, avatar_url, max_athletes, subscription_status, subscription_tier, subscription_current_period_end')
    .eq('id', coachId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

function isInviteExpired(invite) {
  return !invite?.expires_at || new Date(invite.expires_at).getTime() < Date.now();
}

async function markInviteExpired(admin, invite) {
  if (!invite || invite.status !== 'pending' || !isInviteExpired(invite)) return;

  await admin
    .from('coach_invitations')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id);
}

async function findPrimaryCoachConflict(admin, athleteId) {
  const { data, error } = await admin
    .from('coach_athlete_links')
    .select('id, coach_id, status')
    .eq('athlete_id', athleteId)
    .eq('role', 'primary')
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function attachAthleteToCoach(admin, athleteId, coachId) {
  const activePrimary = await findPrimaryCoachConflict(admin, athleteId);
  if (activePrimary?.coach_id && activePrimary.coach_id !== coachId) {
    throw new Error('This athlete already has an active primary coach.');
  }

  const { data: existing } = await admin
    .from('coach_athlete_links')
    .select('id, status')
    .eq('athlete_id', athleteId)
    .eq('coach_id', coachId)
    .eq('role', 'primary')
    .maybeSingle();

  if (existing?.status === 'active') {
    return existing;
  }

  if (existing) {
    const { data, error } = await admin
      .from('coach_athlete_links')
      .update({ status: 'active' })
      .eq('id', existing.id)
      .select('id, athlete_id, coach_id, role, status, created_at')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await admin
    .from('coach_athlete_links')
    .insert({
      athlete_id: athleteId,
      coach_id: coachId,
      role: 'primary',
      status: 'active',
    })
    .select('id, athlete_id, coach_id, role, status, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertCoachRelationship(admin, athleteId, coachProfile) {
  const { data: existing, error: existingError } = await admin
    .from('coach_athlete_relationships')
    .select('id, athlete_id, coach_id, status')
    .eq('athlete_id', athleteId)
    .eq('coach_id', coachProfile.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.status === 'active') {
    return existing;
  }

  await assertCoachSeatAvailable(admin, coachProfile, { allowExistingAthleteId: athleteId });

  if (existing) {
    const { data, error } = await admin
      .from('coach_athlete_relationships')
      .update({
        status: 'active',
        accepted_at: new Date().toISOString(),
        removed_at: null,
      })
      .eq('id', existing.id)
      .select('id, athlete_id, coach_id, status')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await admin
    .from('coach_athlete_relationships')
    .insert({
      coach_id: coachProfile.id,
      athlete_id: athleteId,
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    .select('id, athlete_id, coach_id, status')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export default async function handler(req, res) {
  const token = String(req.query?.token || '').trim();
  if (!token) {
    res.status(400).json({ error: 'Invite token is required.' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const invite = await loadInvite(admin, token);
  if (!invite) {
    res.status(404).json({ error: 'Invite not found.' });
    return;
  }

  const coach = await loadCoachProfile(admin, invite.coach_id);
  if (!coach) {
    res.status(404).json({ error: 'Coach profile not found.' });
    return;
  }

  if (!coachSubscriptionHasAccess(coach)) {
    res.status(410).json({ error: 'This coach subscription is no longer active.', coach });
    return;
  }

  if (invite.status === 'revoked' || invite.revoked_at) {
    res.status(410).json({ error: 'This invite has been revoked.' });
    return;
  }

  if (invite.status === 'accepted' || invite.accepted_at) {
    res.status(409).json({
      error: 'This invite has already been accepted.',
      coach,
    });
    return;
  }

  if (isInviteExpired(invite)) {
    await markInviteExpired(admin, invite);
    res.status(410).json({ error: 'This invite has expired.', coach });
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      invitation: {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        status: invite.status,
        expires_at: invite.expires_at,
      },
      coach,
    });
    return;
  }

  if (req.method === 'POST') {
    const athlete = await getAuthenticatedAthlete(req);
    if (!athlete) {
      res.status(401).json({ error: 'Sign in required before accepting this invite.' });
      return;
    }

    if (invite.email && athlete.email && invite.email.toLowerCase() !== athlete.email.toLowerCase()) {
      res.status(403).json({ error: 'This invite was sent to a different email address.' });
      return;
    }

    try {
      await attachAthleteToCoach(admin, athlete.id, coach.id);
      await upsertCoachRelationship(admin, athlete.id, coach);

      await admin
        .from('coach_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_athlete_id: athlete.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      await admin
        .from('athletes')
        .update({ onboarding_complete: true })
        .eq('id', athlete.id);

      res.status(200).json({
        accepted: true,
        coach,
        redirectTo: `/dashboard?coach_welcome=${encodeURIComponent(coach.display_name)}`,
      });
    } catch (error) {
      console.error('[coach/invitations] accept failed:', error);
      res.status(400).json({ error: error.message || 'Could not accept invite.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
}
