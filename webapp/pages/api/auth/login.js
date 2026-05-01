import {
  findOrCreateAthleteForAuthUser,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
  setAthleteCookie,
} from '../../../lib/authServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const anonClient = getSupabaseAnonServerClient();
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({ email, password });

  if (authError || !authData?.user) {
    res.status(401).json({ error: 'Invalid email or password.' });
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
    res.status(500).json({ error: 'Login succeeded but profile setup failed. Please try again.' });
  }
}
