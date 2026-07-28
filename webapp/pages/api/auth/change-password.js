import {
  bumpSessionVersion,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
} from '../../../lib/authServer';
import { setAthleteCookie } from '../../../lib/auth/sessionCookies.js';
import {
  assertAuthPostMethod,
  AUTH_ERROR_MESSAGES,
  AUTH_STATUS,
  validatePassword,
} from '../../../lib/auth/contracts.js';
import { requireLiveAthleteId } from '../../../lib/auth/requireAthlete.js';
import {
  enforceAuthRateLimit,
  getClientIp,
  recordAuthAttempt,
} from '../../../lib/auth/rateLimit.js';
import { sendPasswordChangedEmail } from '../../../lib/email/transactional.js';

/**
 * POST /api/auth/change-password  { currentPassword, newPassword }
 *
 * For a signed-in user. The current password is required so that someone who
 * borrows an unlocked laptop cannot lock the real owner out of their account.
 *
 * On success every other session is revoked and this browser is re-issued a
 * cookie, so "change password" doubles as "sign out my other devices".
 */
export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const admin = getSupabaseAdminClient();
  const athleteId = await requireLiveAthleteId(req, res, admin);
  if (!athleteId) return;

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    res.status(AUTH_STATUS.BAD_REQUEST).json({ error: 'Enter your current and new password.' });
    return;
  }

  const { data: athlete, error: athleteError } = await admin
    .from('athletes')
    .select('id, name, email, supabase_user_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (athleteError || !athlete) {
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: 'Could not load your account.' });
    return;
  }
  // Strava-only accounts have no Supabase identity and therefore no password.
  if (!athlete.supabase_user_id || !athlete.email) {
    res.status(AUTH_STATUS.BAD_REQUEST).json({ error: AUTH_ERROR_MESSAGES.PASSWORD_CHANGE_UNAVAILABLE });
    return;
  }

  const ip = getClientIp(req);
  if (!(await enforceAuthRateLimit(admin, res, { kind: 'password_change', identifier: athlete.email, ip }))) {
    return;
  }

  const passwordProblem = validatePassword(newPassword, { email: athlete.email });
  if (passwordProblem) {
    res.status(AUTH_STATUS.BAD_REQUEST).json({ error: passwordProblem });
    return;
  }

  // Verified by actually signing in, so the check cannot drift from what the
  // login endpoint accepts.
  const anonClient = getSupabaseAnonServerClient();
  const { data: signIn, error: signInError } = await anonClient.auth.signInWithPassword({
    email: athlete.email,
    password: currentPassword,
  });
  if (signInError || !signIn?.user) {
    await recordAuthAttempt(admin, { kind: 'password_change', identifier: athlete.email, ip, succeeded: false });
    res.status(AUTH_STATUS.UNAUTHORIZED).json({ error: AUTH_ERROR_MESSAGES.CURRENT_PASSWORD_WRONG });
    return;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(athlete.supabase_user_id, {
    password: newPassword,
  });
  if (updateError) {
    console.error('[change-password] update failed:', updateError.message);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: 'Could not update your password. Try again.' });
    return;
  }

  const nextVersion = await bumpSessionVersion(admin, athlete.id);
  setAthleteCookie(res, athlete.id, nextVersion ?? 1);

  await sendPasswordChangedEmail({ name: athlete.name, email: athlete.email });

  res.status(200).json({ ok: true, message: 'Password updated. Other devices have been signed out.' });
}
