import {
  bumpSessionVersion,
  findOrCreateAthleteForAuthUser,
  getSupabaseAdminClient,
} from '../../../lib/authServer';
import { setAthleteCookie } from '../../../lib/auth/sessionCookies.js';
import {
  assertAuthPostMethod,
  AUTH_ERROR_MESSAGES,
  AUTH_STATUS,
  validatePassword,
} from '../../../lib/auth/contracts.js';
import { sendPasswordChangedEmail } from '../../../lib/email/transactional.js';

/**
 * POST /api/auth/reset-password  { accessToken, password }
 *
 * Completes the forgot-password flow. `accessToken` comes from the recovery
 * link the user just clicked, exchanged for a session by /reset-password —
 * possessing it is the proof that they control the mailbox.
 *
 * Setting a new password revokes every session that existed before it. That is
 * the point of a reset: if someone else was signed in on a device you no
 * longer control, changing the password has to push them out.
 */
export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const { accessToken, password } = req.body || {};
  if (!accessToken) {
    res.status(AUTH_STATUS.BAD_REQUEST).json({ error: AUTH_ERROR_MESSAGES.RESET_LINK_INVALID });
    return;
  }

  const admin = getSupabaseAdminClient();
  const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !user) {
    res.status(AUTH_STATUS.UNAUTHORIZED).json({ error: AUTH_ERROR_MESSAGES.RESET_LINK_INVALID });
    return;
  }

  const passwordProblem = validatePassword(password, { email: user.email || '' });
  if (passwordProblem) {
    res.status(AUTH_STATUS.BAD_REQUEST).json({ error: passwordProblem });
    return;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
    // Clicking a link sent to the address proves ownership, so a reset also
    // confirms an address that was still pending verification.
    email_confirm: true,
  });
  if (updateError) {
    console.error('[reset-password] update failed:', updateError.message);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: 'Could not set your new password. Try again.' });
    return;
  }

  try {
    const { athlete } = await findOrCreateAthleteForAuthUser({
      admin,
      supabaseUserId: user.id,
      email: user.email || null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      emailVerified: true,
    });

    // Kills every cookie issued before this moment, including any the person
    // who prompted the reset may be holding.
    const nextVersion = await bumpSessionVersion(admin, athlete.id);

    // Then hand this browser a fresh one so the user stays signed in.
    setAthleteCookie(res, athlete.id, nextVersion ?? athlete.session_version);

    await sendPasswordChangedEmail({ name: athlete.name, email: athlete.email });

    res.status(200).json({
      ok: true,
      athleteId: athlete.id,
      onboardingComplete: Boolean(athlete.onboarding_complete),
    });
  } catch (error) {
    console.error('[reset-password] profile sync failed:', error);
    // The password itself did change, so say so rather than implying a retry.
    res.status(AUTH_STATUS.SERVER_ERROR).json({
      error: 'Your password was updated, but signing you in failed. Please log in.',
    });
  }
}
