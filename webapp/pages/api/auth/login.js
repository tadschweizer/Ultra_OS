import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';

/**
 * POST /api/auth/login
 *
 * Authenticates via Supabase Auth (email + password).
 * Looks up the matching athlete record and sets the athlete_id cookie.
 *
 * Body: { email, password }
 * Returns: { athleteId, name, onboardingComplete } on success
 */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase service role env vars');
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

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

  // 1. Verify credentials with Supabase Auth
  const anonClient = getAnonClient();
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({ email, password });

  if (authError || !authData?.user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const supabaseUserId = authData.user.id;

  // 2. Look up the athlete by supabase_user_id (primary) or email (fallback for Strava-origin accounts)
  const admin = getAdminClient();
  let { data: athlete } = await admin
    .from('athletes')
    .select('id, name, onboarding_complete, subscription_tier, supabase_user_id')
    .eq('supabase_user_id', supabaseUserId)
    .maybeSingle();

  if (!athlete) {
    // Fallback: find by email and link the supabase_user_id now
    const { data: emailAthlete } = await admin
      .from('athletes')
      .select('id, name, onboarding_complete, subscription_tier')
      .eq('email', email)
      .maybeSingle();

    if (emailAthlete) {
      await admin
        .from('athletes')
        .update({ supabase_user_id: supabaseUserId })
        .eq('id', emailAthlete.id);
      athlete = emailAthlete;
    }
  }

  if (!athlete) {
    // Auth user exists but no athlete record — create one (edge case)
    const { data: newAthlete, error: insertError } = await admin
      .from('athletes')
      .insert({
        email,
        supabase_user_id: supabaseUserId,
        subscription_tier: 'free',
      })
      .select('id, name, onboarding_complete')
      .single();

    if (insertError) {
      console.error('[login] Athlete creation failed:', insertError);
      res.status(500).json({ error: 'Login succeeded but profile setup failed. Please contact support.' });
      return;
    }
    athlete = newAthlete;
  }

  // 3. Set athlete_id cookie
  const cookieStr = cookie.serialize('athlete_id', athlete.id, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  res.setHeader('Set-Cookie', cookieStr);

  res.status(200).json({
    athleteId: athlete.id,
    name: athlete.name,
    onboardingComplete: Boolean(athlete.onboarding_complete),
    subscriptionTier: athlete.subscription_tier || 'free',
  });
}
