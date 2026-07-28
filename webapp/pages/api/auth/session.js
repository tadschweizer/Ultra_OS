import { findOrCreateAthleteForAuthUser, getSupabaseAdminClient } from '../../../lib/authServer';
import { setAthleteCookie } from '../../../lib/auth/sessionCookies.js';
import { assertAuthPostMethod, AUTH_ERROR_MESSAGES, AUTH_STATUS } from '../../../lib/auth/contracts.js';
import { sendWelcomeEmail } from '../../../lib/email/transactional.js';

/**
 * Exchanges a verified Supabase access token for this app's session cookie.
 * Reached from /auth/callback after Google sign-in and after a user clicks the
 * email-confirmation link — which is where an account created by an unverified
 * signup finally gets to adopt a matching athlete row.
 */
export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const { accessToken } = req.body || {};
  if (!accessToken) {
    res.status(AUTH_STATUS.BAD_REQUEST).json({ error: AUTH_ERROR_MESSAGES.MISSING_ACCESS_TOKEN });
    return;
  }

  const admin = getSupabaseAdminClient();
  const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);

  if (userError || !user) {
    res.status(AUTH_STATUS.UNAUTHORIZED).json({ error: AUTH_ERROR_MESSAGES.INVALID_SESSION_TOKEN });
    return;
  }

  // Google and the other OAuth providers only hand back an identity once the
  // provider itself has confirmed the address, so `email_confirmed_at` is the
  // single signal that decides whether this login may claim an existing row.
  const emailVerified = Boolean(user.email_confirmed_at);

  try {
    const { athlete, isNewAthlete } = await findOrCreateAthleteForAuthUser({
      admin,
      supabaseUserId: user.id,
      email: user.email || null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      emailVerified,
    });

    setAthleteCookie(res, athlete.id, athlete.session_version);

    if (isNewAthlete) {
      await sendWelcomeEmail({ name: athlete.name, email: athlete.email });
    }

    res.status(200).json({
      athleteId: athlete.id,
      name: athlete.name,
      onboardingComplete: Boolean(athlete.onboarding_complete),
      subscriptionTier: athlete.subscription_tier,
      isNewAthlete,
      emailVerified,
    });
  } catch (error) {
    console.error('[session] sync error:', error);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: AUTH_ERROR_MESSAGES.SESSION_SYNC_FAILED });
  }
}
