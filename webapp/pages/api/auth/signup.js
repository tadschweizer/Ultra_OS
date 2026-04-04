import { findOrCreateAthleteForAuthUser, getSupabaseAdminClient, setAthleteCookie } from '../../../lib/authServer';

export const runtime = 'edge';

async function sendWelcomeEmail({ athleteId, name, email }) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId, name, email }),
    });
  } catch (error) {
    console.warn('[signup] Welcome email failed (non-fatal):', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email, password, name } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    const isDuplicate = authError?.message?.toLowerCase().includes('already')
      || authError?.code === 'email_exists';
    res.status(isDuplicate ? 409 : 500).json({
      error: isDuplicate
        ? 'An account with that email already exists. Try logging in instead.'
        : 'Could not create account. Please try again.',
    });
    return;
  }

  try {
    const { athlete, isNewAthlete } = await findOrCreateAthleteForAuthUser({
      admin,
      supabaseUserId: authData.user.id,
      email,
      name: name?.trim() || null,
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
    console.error('[signup] profile creation error:', error);
    await admin.auth.admin.deleteUser(authData.user.id);
    res.status(500).json({ error: 'Could not create athlete profile. Please try again.' });
  }
}
