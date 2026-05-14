import {
  findOrCreateAthleteForAuthUser,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
} from '../../../lib/authServer';
import { setAthleteCookie } from '../../../lib/auth/sessionCookies.js';
import { assertAuthPostMethod, AUTH_ERROR_MESSAGES, AUTH_STATUS } from '../../../lib/auth/contracts.js';

export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const anonClient = getSupabaseAnonServerClient();
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({ email, password });

  if (authError || !authData?.user) {
    res.status(AUTH_STATUS.UNAUTHORIZED).json({ error: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS });
    return;
  }

  try {
    const { athlete } = await findOrCreateAthleteForAuthUser({
      admin: getSupabaseAdminClient(),
      supabaseUserId: authData.user.id,
      email: authData.user.email || email,
      name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || null,
    });

    setAthleteCookie(res, athlete.id);

    res.status(200).json({
      athleteId: athlete.id,
      name: athlete.name,
      onboardingComplete: Boolean(athlete.onboarding_complete),
      subscriptionTier: athlete.subscription_tier,
    });
  } catch (error) {
    console.error('[login] athlete lookup error:', error);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: AUTH_ERROR_MESSAGES.LOGIN_PROFILE_SYNC_FAILED });
  }
}
