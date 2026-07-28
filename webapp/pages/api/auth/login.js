import {
  findOrCreateAthleteForAuthUser,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
} from '../../../lib/authServer';
import { setAthleteCookie } from '../../../lib/auth/sessionCookies.js';
import { assertAuthPostMethod, AUTH_ERROR_MESSAGES, AUTH_STATUS } from '../../../lib/auth/contracts.js';
import {
  clearAuthAttempts,
  enforceAuthRateLimit,
  getClientIp,
  recordAuthAttempt,
} from '../../../lib/auth/rateLimit.js';

/**
 * Distinguishes "wrong password" from "this account has no password at all".
 *
 * An athlete created through Strava has no Supabase identity and therefore no
 * password, so every attempt returns the same "invalid credentials" and the
 * user has no way to learn they should be using the Strava button. Saying so
 * is not a disclosure risk — reaching this branch already required knowing the
 * address, and the signup form's duplicate-account error reveals the same fact.
 */
async function isOAuthOnlyAccount(admin, email) {
  try {
    const { data, error } = await admin
      .from('athletes')
      .select('supabase_user_id, strava_id')
      .eq('email', email)
      .limit(1);
    if (error || !data?.length) return false;
    const athlete = data[0];
    return !athlete.supabase_user_id && Boolean(athlete.strava_id);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const ip = getClientIp(req);

  // Checked before the password is verified, so guessing runs into the
  // lockout rather than into an unlimited oracle.
  if (!(await enforceAuthRateLimit(admin, res, { kind: 'login', identifier: email, ip }))) return;

  const anonClient = getSupabaseAnonServerClient();
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({ email, password });

  if (authError || !authData?.user) {
    await recordAuthAttempt(admin, { kind: 'login', identifier: email, ip, succeeded: false });
    const oauthOnly = await isOAuthOnlyAccount(admin, email);
    res.status(AUTH_STATUS.UNAUTHORIZED).json({
      error: oauthOnly ? AUTH_ERROR_MESSAGES.OAUTH_ONLY_ACCOUNT : AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
    });
    return;
  }

  const emailVerified = Boolean(authData.user.email_confirmed_at);

  try {
    const { athlete } = await findOrCreateAthleteForAuthUser({
      admin,
      supabaseUserId: authData.user.id,
      email: authData.user.email || email,
      name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || null,
      emailVerified,
    });

    setAthleteCookie(res, athlete.id, athlete.session_version);
    await clearAuthAttempts(admin, { kind: 'login', identifier: email, ip });
    await recordAuthAttempt(admin, { kind: 'login', identifier: email, ip, succeeded: true });

    res.status(200).json({
      athleteId: athlete.id,
      name: athlete.name,
      onboardingComplete: Boolean(athlete.onboarding_complete),
      subscriptionTier: athlete.subscription_tier,
      emailVerified,
    });
  } catch (error) {
    console.error('[login] athlete lookup error:', error);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: AUTH_ERROR_MESSAGES.LOGIN_PROFILE_SYNC_FAILED });
  }
}
