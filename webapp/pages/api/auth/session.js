import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';

/**
 * POST /api/auth/session
 *
 * Called by the client-side OAuth callback page (/auth/callback)
 * after Supabase has exchanged the OAuth code for a session on the client.
 *
 * Accepts the Supabase access_token, verifies it server-side,
 * then finds or creates the athlete record and sets the athlete_id cookie.
 *
 * Body: { accessToken, provider }  (provider = 'google')
 * Returns: { athleteId, name, onboardingComplete, isNewAthlete }
 */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase service role env vars');
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { accessToken, provider } = req.body || {};
  if (!accessToken) {
    res.status(400).json({ error: 'Missing accessToken' });
    return;
  }

  const admin = getAdminClient();

  // 1. Verify the token and get the user
  const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !user) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }

  const supabaseUserId = user.id;
  const email = user.email;
  const name = user.user_metadata?.full_name || user.user_metadata?.name || null;

  // 2. Find or create athlete
  let isNewAthlete = false;
  let { data: athlete } = await admin
    .from('athletes')
    .select('id, name, onboarding_complete, subscription_tier')
    .eq('supabase_user_id', supabaseUserId)
    .maybeSingle();

  if (!athlete && email) {
    // Try to find an existing athlete by email (e.g. a Strava account with same email)
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
    // Brand new user via OAuth — create athlete
    const { data: newAthlete, error: insertError } = await admin
      .from('athletes')
      .insert({
        name,
        email,
        supabase_user_id: supabaseUserId,
        subscription_tier: 'free',
      })
      .select('id, name, onboarding_complete')
      .single();

    if (insertError) {
      console.error('[session] Athlete insert error:', insertError);
      res.status(500).json({ error: 'Could not create athlete profile.' });
      return;
    }

    athlete = newAthlete;
    isNewAthlete = true;
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

  // 4. Fire welcome email for new athletes (non-blocking)
  if (isNewAthlete) {
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId: athlete.id, name: athlete.name, email }),
    }).catch((err) => console.warn('[session] Welcome email failed (non-fatal):', err));
  }

  res.status(200).json({
    athleteId: athlete.id,
    name: athlete.name,
    onboardingComplete: Boolean(athlete.onboarding_complete),
    isNewAthlete,
  });
}
