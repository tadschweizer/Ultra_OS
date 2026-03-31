import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';

/**
 * POST /api/auth/signup
 *
 * Creates a new account via Supabase Auth (email + password),
 * then upserts an athlete record linked to that auth user.
 * Sets the athlete_id cookie so the rest of the app works immediately.
 *
 * Body: { email, password, name }
 * Returns: { athleteId, name } on success
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

  const { email, password, name } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  const admin = getAdminClient();

  // 1. Create the Supabase Auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip confirmation email for now — add email confirm flow later
  });

  if (authError) {
    const isAlreadyExists = authError.message?.toLowerCase().includes('already registered')
      || authError.message?.toLowerCase().includes('already exists')
      || authError.code === 'email_exists';
    if (isAlreadyExists) {
      res.status(409).json({ error: 'An account with that email already exists. Try logging in.' });
    } else {
      console.error('[signup] Supabase auth error:', authError);
      res.status(500).json({ error: 'Could not create account. Please try again.' });
    }
    return;
  }

  const supabaseUserId = authData.user.id;

  // 2. Create the athlete record, linked to the Supabase Auth user
  //    If an athlete with this email already exists (e.g. a Strava user), link them.
  const { data: existingAthlete } = await admin
    .from('athletes')
    .select('id, supabase_user_id')
    .eq('email', email)
    .maybeSingle();

  let athleteId;
  let isNewAthlete = false;

  if (existingAthlete) {
    // Link the existing athlete to the new Supabase Auth user
    await admin
      .from('athletes')
      .update({ supabase_user_id: supabaseUserId, subscription_tier: existingAthlete.subscription_tier || 'free' })
      .eq('id', existingAthlete.id);
    athleteId = existingAthlete.id;
  } else {
    // Create a brand-new athlete
    const { data: newAthlete, error: insertError } = await admin
      .from('athletes')
      .insert({
        name: name?.trim() || null,
        email,
        supabase_user_id: supabaseUserId,
        subscription_tier: 'free',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[signup] Athlete insert error:', insertError);
      // Clean up the auth user we just created to avoid orphaned accounts
      await admin.auth.admin.deleteUser(supabaseUserId);
      res.status(500).json({ error: 'Could not create athlete profile. Please try again.' });
      return;
    }

    athleteId = newAthlete.id;
    isNewAthlete = true;
  }

  // 3. Set the athlete_id cookie (same pattern as Strava callback)
  const cookieStr = cookie.serialize('athlete_id', athleteId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  res.setHeader('Set-Cookie', cookieStr);

  // 4. Fire welcome email (non-blocking — don't fail signup if email fails)
  if (isNewAthlete) {
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId, name: name?.trim() || null, email }),
    }).catch((err) => console.warn('[signup] Welcome email failed (non-fatal):', err));
  }

  res.status(200).json({ athleteId, name: name?.trim() || null, isNewAthlete });
}
