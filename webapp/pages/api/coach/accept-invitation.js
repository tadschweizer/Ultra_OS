import { getSupabaseAdminClient } from '../../../lib/authServer';
import { assertAuthPostMethod } from '../../../lib/auth/contracts.js';
import { requireLiveAthleteId } from '../../../lib/auth/requireAthlete.js';

/**
 * POST /api/coach/accept-invitation  { token }
 *
 * The missing half of the coach invitation flow. `coach_invitations` rows were
 * being created with a token and an expiry, and an email was expected to carry
 * that token to the athlete — but nothing in the codebase ever read one back,
 * so no invitation could be accepted. Every invite ever sent was inert.
 *
 * Requires a signed-in athlete: accepting is the athlete's act of consent, and
 * it needs to attach to a real account. The invited address must match the
 * account's, so a leaked token cannot be redeemed by whoever finds it.
 */
export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const admin = getSupabaseAdminClient();
  const athleteId = await requireLiveAthleteId(req, res, admin);
  if (!athleteId) return;

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'An invitation token is required.' });
    return;
  }

  const { data: invitation, error: inviteError } = await admin
    .from('coach_invitations')
    .select('id, coach_id, email, status, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (inviteError || !invitation) {
    res.status(404).json({ error: 'That invitation link is not valid.' });
    return;
  }
  if (invitation.status !== 'pending') {
    res.status(409).json({ error: 'That invitation has already been used or was revoked.' });
    return;
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    await admin.from('coach_invitations').update({ status: 'expired' }).eq('id', invitation.id);
    res.status(410).json({ error: 'That invitation has expired. Ask your coach to send a new one.' });
    return;
  }

  const { data: athlete, error: athleteError } = await admin
    .from('athletes')
    .select('id, email')
    .eq('id', athleteId)
    .maybeSingle();

  if (athleteError || !athlete) {
    res.status(500).json({ error: 'Could not load your account.' });
    return;
  }

  // Binds the invite to the person it was sent to. Without this, anyone who
  // came across the link could join the roster in the invitee's place.
  if ((athlete.email || '').toLowerCase() !== invitation.email.toLowerCase()) {
    res.status(403).json({
      error: 'This invitation was sent to a different email address. Log in with that account to accept it.',
    });
    return;
  }

  const { data: coachProfile } = await admin
    .from('coach_profiles')
    .select('id, athlete_id, display_name')
    .eq('id', invitation.coach_id)
    .maybeSingle();

  if (!coachProfile) {
    res.status(404).json({ error: 'That coach account no longer exists.' });
    return;
  }
  if (coachProfile.athlete_id === athleteId) {
    res.status(400).json({ error: 'You cannot accept your own invitation.' });
    return;
  }

  const now = new Date().toISOString();

  // Both sides have now agreed — the coach by inviting, the athlete by
  // accepting — so this goes straight to active.
  const { error: relationshipError } = await admin
    .from('coach_athlete_relationships')
    .upsert(
      {
        coach_id: invitation.coach_id,
        athlete_id: athleteId,
        status: 'active',
        accepted_at: now,
        initiated_by: 'coach',
      },
      { onConflict: 'coach_id,athlete_id' }
    );

  if (relationshipError) {
    res.status(500).json({ error: relationshipError.message });
    return;
  }

  const { data: existingLink } = await admin
    .from('coach_athlete_links')
    .select('id')
    .eq('athlete_id', athleteId)
    .eq('coach_id', invitation.coach_id)
    .maybeSingle();

  if (existingLink) {
    await admin.from('coach_athlete_links').update({ status: 'active' }).eq('id', existingLink.id);
  } else {
    // Falls back to secondary when a primary coach is already in place, so
    // accepting a second invite cannot violate the one-active-role index.
    const { data: primaryTaken } = await admin
      .from('coach_athlete_links')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('role', 'primary')
      .eq('status', 'active')
      .maybeSingle();

    await admin.from('coach_athlete_links').insert({
      athlete_id: athleteId,
      coach_id: invitation.coach_id,
      role: primaryTaken ? 'secondary' : 'primary',
      status: 'active',
    });
  }

  await admin
    .from('coach_invitations')
    .update({ status: 'accepted', accepted_at: now })
    .eq('id', invitation.id);

  res.status(200).json({
    ok: true,
    coach: { id: coachProfile.id, display_name: coachProfile.display_name },
  });
}
