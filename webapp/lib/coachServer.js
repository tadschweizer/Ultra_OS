import crypto from 'crypto';
import { getAthleteIdFromRequest, getSupabaseAdminClient } from './authServer';
import { generateCoachCode } from './coachProtocols';

export const COACH_SPECIALTY_OPTIONS = [
  'Ultrarunning',
  'Gravel',
  'Triathlon',
  'Trail Running',
  'Road Cycling',
  'Other',
];

export function parseCommaSeparatedList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCoachSpecialties(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter((value) => COACH_SPECIALTY_OPTIONS.includes(value))
    )
  );
}

function normalizeBaseUrl(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input.replace(/\/$/, '');
  }
  return `https://${input.replace(/\/$/, '')}`;
}

function getRequestOrigin(req) {
  const forwardedProto = req?.headers?.['x-forwarded-proto'];
  const forwardedHost = req?.headers?.['x-forwarded-host'];
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = req?.headers?.host;
  if (!host) return null;
  const protocol = host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export function getCanonicalSiteUrl(req) {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL)
    || normalizeBaseUrl(process.env.SITE_URL)
    || normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    || normalizeBaseUrl(getRequestOrigin(req))
    || 'http://localhost:3000';
}

export function buildCoachInviteUrl(token, req) {
  const baseUrl = getCanonicalSiteUrl(req);
  return `${baseUrl.replace(/\/$/, '')}/invite/${token}`;
}

export function createInviteToken() {
  return crypto.randomBytes(24).toString('hex');
}

export async function getAuthenticatedAthlete(req) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) return null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('athletes')
    .select('id, name, email, onboarding_complete, subscription_tier, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status')
    .eq('id', athleteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function generateUniqueCoachCode(admin, displayName) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCoachCode(displayName);
    const { data } = await admin
      .from('coach_profiles')
      .select('id')
      .eq('coach_code', code)
      .maybeSingle();

    if (!data) {
      return code;
    }
  }

  throw new Error('Could not generate a unique coach code.');
}

export async function getCoachProfileByAthleteId(admin, athleteId) {
  const { data, error } = await admin
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code, bio, specialties, certifications, avatar_url, onboarding_completed, max_athletes, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_tier, subscription_current_period_end, subscription_cancel_at, subscription_cancel_at_period_end, created_at, updated_at')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function ensureCoachProfile(admin, athlete, overrides = {}) {
  const existing = await getCoachProfileByAthleteId(admin, athlete.id);
  if (existing) {
    return existing;
  }

  const displayName = overrides.display_name?.trim() || athlete.name || 'Coach';
  const coachCode = await generateUniqueCoachCode(admin, displayName);
  const certifications = Array.isArray(overrides.certifications)
    ? overrides.certifications
    : parseCommaSeparatedList(overrides.certifications);

  const { data, error } = await admin
    .from('coach_profiles')
    .insert({
      athlete_id: athlete.id,
      display_name: displayName,
      coach_code: coachCode,
      bio: overrides.bio?.trim() || null,
      specialties: normalizeCoachSpecialties(overrides.specialties || []),
      certifications,
      avatar_url: overrides.avatar_url || null,
      onboarding_completed: Boolean(overrides.onboarding_completed),
    })
    .select('id, athlete_id, display_name, coach_code, bio, specialties, certifications, avatar_url, onboarding_completed, max_athletes, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_tier, subscription_current_period_end, subscription_cancel_at, subscription_cancel_at_period_end, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
