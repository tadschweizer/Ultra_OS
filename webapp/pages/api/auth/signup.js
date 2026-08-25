import { findOrCreateAthleteForAuthUser, getSupabaseAdminClient } from '../../../lib/authServer';
import { setAthleteCookie } from '../../../lib/auth/sessionCookies.js';
import {
  assertAuthPostMethod,
  AUTH_ERROR_MESSAGES,
  AUTH_STATUS,
  validatePassword,
} from '../../../lib/auth/contracts.js';
import {
  enforceAuthRateLimit,
  getClientIp,
  recordAuthAttempt,
} from '../../../lib/auth/rateLimit.js';
import { getSiteUrl, sendVerificationEmail, sendWelcomeEmail } from '../../../lib/email/transactional.js';
import { safeNextPath } from '../../../lib/auth/redirects.js';
import { primaryRoleForSignupRole } from '../../../lib/auth/roleGuards.js';
import {
  normalizeSignupRoleIntent,
  setSignupRoleIntent,
} from '../../../lib/auth/signupRoleIntent.js';

export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const { email, password, name, role, next } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const passwordProblem = validatePassword(password, { email });
  if (passwordProblem) {
    res.status(400).json({ error: passwordProblem });
    return;
  }

  const signupRole = normalizeSignupRoleIntent(role, next);
  if (!signupRole) {
    res.status(400).json({ error: 'role must be coach, athlete-with-coach, or individual.' });
    return;
  }
  const primaryRole = primaryRoleForSignupRole(signupRole);
  const nextPath = safeNextPath(next, '');
  const callbackUrl = new URL('/auth/callback', getSiteUrl());
  if (nextPath) callbackUrl.searchParams.set('next', nextPath);

  const admin = getSupabaseAdminClient();
  const ip = getClientIp(req);
  if (!(await enforceAuthRateLimit(admin, res, { kind: 'signup', identifier: email, ip }))) return;

  // `generateLink` creates the user AND returns its confirmation link in one
  // call. The previous implementation used `createUser({ email_confirm: true })`,
  // which marked the address confirmed without ever proving the signer-up owned
  // it — and `findOrCreateAthleteForAuthUser` trusted that flag to merge the new
  // login into any existing athlete with the same email. Anyone who knew a
  // Strava-created athlete's address could take over their account that way.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { redirectTo: callbackUrl.toString() },
  });

  if (linkError || !linkData?.user) {
    await recordAuthAttempt(admin, { kind: 'signup', identifier: email, ip, succeeded: false });
    const message = linkError?.message?.toLowerCase() || '';
    const isDuplicate = message.includes('already') || linkError?.code === 'email_exists';
    res.status(isDuplicate ? AUTH_STATUS.CONFLICT : AUTH_STATUS.SERVER_ERROR).json({
      error: isDuplicate ? AUTH_ERROR_MESSAGES.DUPLICATE_ACCOUNT : AUTH_ERROR_MESSAGES.SIGNUP_FAILED,
    });
    return;
  }

  const authUser = linkData.user;
  const verifyUrl = linkData.properties?.action_link || null;

  try {
    const { athlete, isNewAthlete } = await findOrCreateAthleteForAuthUser({
      admin,
      supabaseUserId: authUser.id,
      email,
      name: name?.trim() || null,
      // Nothing has been proven yet, so this signup gets a fresh athlete and
      // cannot adopt an existing row until the address is confirmed.
      emailVerified: false,
      primaryRole,
    });

    setAthleteCookie(res, athlete.id, athlete.session_version);
    setSignupRoleIntent(res, signupRole);
    await recordAuthAttempt(admin, { kind: 'signup', identifier: email, ip, succeeded: true });

    // Both sends are best-effort — a mail outage must not fail the signup.
    await sendVerificationEmail({ name: athlete.name, email, verifyUrl });
    if (isNewAthlete) {
      await sendWelcomeEmail({ name: athlete.name, email: athlete.email });
    }

    res.status(200).json({
      athleteId: athlete.id,
      name: athlete.name,
      onboardingComplete: Boolean(athlete.onboarding_complete),
      subscriptionTier: athlete.subscription_tier,
      isNewAthlete,
      emailVerified: false,
      verificationEmailSent: Boolean(verifyUrl),
      primaryRole: athlete.primary_role,
    });
  } catch (error) {
    console.error('[signup] profile creation error:', error);
    await admin.auth.admin.deleteUser(authUser.id);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: AUTH_ERROR_MESSAGES.SIGNUP_PROFILE_FAILED });
  }
}
