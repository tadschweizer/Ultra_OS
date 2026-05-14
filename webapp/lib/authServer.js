import { createClient } from '@supabase/supabase-js';
import { normalizeSubscriptionTier } from './subscriptionTiers';
import { getAthleteIdFromRequest } from './auth/sessionCookies.js';

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

export async function findOrCreateAthleteForAuthUser({
  admin,
  supabaseUserId,
  email,
  name = null,
}) {
  let isNewAthlete = false;
  let { data: athlete, error: athleteLookupError } = await admin
    .from('athletes')
    .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id')
    .eq('supabase_user_id', supabaseUserId)
    .maybeSingle();

  if (athleteLookupError) {
    throw athleteLookupError;
  }

  if (!athlete && email) {
    const { data: emailAthlete, error: emailLookupError } = await admin
      .from('athletes')
      .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id')
      .eq('email', email)
      .maybeSingle();

    if (emailLookupError) {
      throw emailLookupError;
    }

    if (emailAthlete) {
      const normalizedTier = normalizeSubscriptionTier(emailAthlete.subscription_tier);
      const { data: linkedAthlete, error: linkError } = await admin
        .from('athletes')
        .update({
          supabase_user_id: supabaseUserId,
          subscription_tier: normalizedTier,
        })
        .eq('id', emailAthlete.id)
        .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id')
        .single();

      if (linkError) {
        throw linkError;
      }

      athlete = linkedAthlete;
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
      .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id')
      .single();

    if (insertError) {
      throw insertError;
    }

    athlete = newAthlete;
    isNewAthlete = true;
  }

  athlete.subscription_tier = normalizeSubscriptionTier(athlete.subscription_tier);
  return { athlete, isNewAthlete };
}

export async function getAthleteByCookie(req, client) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    return null;
  }

  const { data: athlete, error } = await client
    .from('athletes')
    .select('*')
    .eq('id', athleteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!athlete) return null;
  return {
    ...athlete,
    subscription_tier: normalizeSubscriptionTier(athlete.subscription_tier),
  };
}
