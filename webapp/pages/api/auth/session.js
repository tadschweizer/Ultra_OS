import { findOrCreateAthleteForAuthUser, getSupabaseAdminClient } from '../../../lib/authServer';
import { setAthleteCookie } from '../../../lib/auth/sessionCookies.js';
import { assertAuthPostMethod, AUTH_ERROR_MESSAGES, AUTH_STATUS } from '../../../lib/auth/contracts.js';

async function sendWelcomeEmail({ athleteId, name, email }) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId, name, email }),
    });
  } catch (error) {
    console.warn('[session] Welcome email failed (non-fatal):', error);
  }
}

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

  try {
    const { athlete, isNewAthlete } = await findOrCreateAthleteForAuthUser({
      admin,
      supabaseUserId: user.id,
      email: user.email || null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    });

    setAthleteCookie(res, athlete.id);

    if (isNewAthlete) {
      sendWelcomeEmail({ athleteId: athlete.id, name: athlete.name, email: athlete.email });
    }

    res.status(200).json({
      athleteId: athlete.id,
      name: athlete.name,
      onboardingComplete: Boolean(athlete.onboarding_complete),
      subscriptionTier: athlete.subscription_tier,
      isNewAthlete,
    });
  } catch (error) {
    console.error('[session] sync error:', error);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: AUTH_ERROR_MESSAGES.SESSION_SYNC_FAILED });
  }
}
