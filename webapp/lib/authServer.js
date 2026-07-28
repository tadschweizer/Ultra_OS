import { createClient } from '@supabase/supabase-js';
import { normalizeSubscriptionTier } from './subscriptionTiers.js';
import { getSessionFromRequest } from './auth/sessionCookies.js';

let adminClient = null;
let anonClient = null;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseAdminClient() {
  if (!adminClient) {
    adminClient = createClient(
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return adminClient;
}

export function getSupabaseAnonServerClient() {
  if (!anonClient) {
    anonClient = createClient(
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return anonClient;
}

const ATHLETE_FIELDS =
  'id, name, email, onboarding_complete, subscription_tier, supabase_user_id, session_version, email_verified_at';

/**
 * Resolves the athlete row for a Supabase identity, creating one if needed.
 *
 * The email-match branch is an account-takeover path if it trusts an
 * unverified address: an athlete created through Strava has an email but no
 * password login, so anyone who knows that address could once sign up with it
 * and be handed the existing row — training history, coach links and billing
 * tier included. Two rules close that:
 *
 *   1. `emailVerified` must be true. An identity that has not proven it owns
 *      the address gets a brand-new athlete instead of an existing one.
 *   2. Only rows with a null `supabase_user_id` may be adopted. An athlete
 *      already bound to a login is never re-pointed at a different one.
 *
 * A user who signs up unverified is not stuck: once they click the
 * verification link, the next sign-in runs this again with emailVerified true
 * and adopts the waiting row.
 */
export async function findOrCreateAthleteForAuthUser({
  admin,
  supabaseUserId,
  email,
  name = null,
  emailVerified = false,
}) {
  let isNewAthlete = false;
  let { data: athlete, error: athleteLookupError } = await admin
    .from('athletes')
    .select(ATHLETE_FIELDS)
    .eq('supabase_user_id', supabaseUserId)
    .maybeSingle();

  if (athleteLookupError) {
    throw athleteLookupError;
  }

  if (!athlete && email && emailVerified) {
    // `limit(1)` rather than `maybeSingle()`: athletes.email has no unique
    // constraint, and an unverified signup may already have parked a second
    // row on this address. Oldest wins, which is the pre-existing account.
    const { data: emailAthletes, error: emailLookupError } = await admin
      .from('athletes')
      .select(ATHLETE_FIELDS)
      .eq('email', email)
      .is('supabase_user_id', null)
      .order('id', { ascending: true })
      .limit(1);

    if (emailLookupError) {
      throw emailLookupError;
    }

    const emailAthlete = emailAthletes?.[0];
    if (emailAthlete) {
      const normalizedTier = normalizeSubscriptionTier(emailAthlete.subscription_tier);
      // The `is('supabase_user_id', null)` filter is repeated on the write so
      // two concurrent sign-ins cannot both claim the same row.
      const { data: linkedAthlete, error: linkError } = await admin
        .from('athletes')
        .update({
          supabase_user_id: supabaseUserId,
          subscription_tier: normalizedTier,
        })
        .eq('id', emailAthlete.id)
        .is('supabase_user_id', null)
        .select(ATHLETE_FIELDS)
        .maybeSingle();

      if (linkError) {
        throw linkError;
      }

      // Null means another request adopted it first; fall through and create
      // a fresh athlete rather than silently sharing one.
      if (linkedAthlete) athlete = linkedAthlete;
    }
  }

  if (!athlete) {
    const { data: newAthlete, error: insertError } = await admin
      .from('athletes')
      .insert({
        name,
        email,
        supabase_user_id: supabaseUserId,
        subscription_tier: 'free',
      })
      .select(ATHLETE_FIELDS)
      .single();

    if (insertError) {
      throw insertError;
    }

    athlete = newAthlete;
    isNewAthlete = true;
  }

  // Mirror the auth user's confirmation onto the athlete row the first time we
  // see it, so /api/me can report verification state without reaching into the
  // auth schema on every page load.
  if (emailVerified && !athlete.email_verified_at) {
    const verifiedAt = new Date().toISOString();
    const { error: verifyError } = await admin
      .from('athletes')
      .update({ email_verified_at: verifiedAt })
      .eq('id', athlete.id);
    if (verifyError) {
      // Non-fatal: the flag is a cache, and the next sign-in retries it.
      console.warn('[auth] could not record email verification:', verifyError.message);
    } else {
      athlete.email_verified_at = verifiedAt;
    }
  }

  athlete.subscription_tier = normalizeSubscriptionTier(athlete.subscription_tier);
  return { athlete, isNewAthlete };
}

/**
 * Invalidates every session cookie issued for this athlete by bumping the
 * version baked into the cookie signature. Call after a password change, a
 * password reset, or "sign out everywhere".
 *
 * Returns the new version, or null if the athlete no longer exists.
 */
export async function bumpSessionVersion(admin, athleteId) {
  const { data: current, error: readError } = await admin
    .from('athletes')
    .select('session_version')
    .eq('id', athleteId)
    .maybeSingle();

  if (readError) throw readError;
  if (!current) return null;

  const nextVersion = Number(current.session_version || 1) + 1;
  const { error: writeError } = await admin
    .from('athletes')
    .update({ session_version: nextVersion })
    .eq('id', athleteId);

  if (writeError) throw writeError;
  return nextVersion;
}

export async function getAthleteByCookie(req, client) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return null;
  }

  const { data: athlete, error } = await client
    .from('athletes')
    .select('*')
    .eq('id', session.athleteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!athlete) return null;
  // Revoked by a password change, reset, or "sign out everywhere".
  if (Number(athlete.session_version || 1) !== session.sessionVersion) return null;
  return {
    ...athlete,
    subscription_tier: normalizeSubscriptionTier(athlete.subscription_tier),
  };
}
