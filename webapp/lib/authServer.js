import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';
import crypto from 'crypto';
import { normalizeSubscriptionTier } from './subscriptionTiers';

let adminClient = null;
let anonClient = null;
const ATHLETE_COOKIE_NAME = 'athlete_id';
const ADMIN_COOKIE_NAME = 'admin_access';
const ATHLETE_SESSION_COOKIE_NAME = 'threshold_session';

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

export function parseRequestCookies(req) {
  return cookie.parse(req.headers.cookie || '');
}

function getAdminCookieSecret() {
  return process.env.ADMIN_SESSION_SECRET || getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
}

function createSignedValue(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getAdminCookieSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

function readSignedValue(rawValue) {
  if (!rawValue) return null;

  const [encodedPayload, providedSignature] = rawValue.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', getAdminCookieSecret())
    .update(encodedPayload)
    .digest('base64url');

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function appendSetCookie(res, nextCookie) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', nextCookie);
    return;
  }
  const cookies = Array.isArray(current) ? current : [current];
  res.setHeader('Set-Cookie', [...cookies, nextCookie]);
}

export function setAthleteCookie(res, athleteId) {
  appendSetCookie(
    res,
    cookie.serialize(ATHLETE_COOKIE_NAME, athleteId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  );
  setSignedAthleteSessionCookie(res, athleteId);
}

export function clearAthleteCookie(res) {
  appendSetCookie(
    res,
    cookie.serialize(ATHLETE_COOKIE_NAME, '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
  clearSignedAthleteSessionCookie(res);
  clearAdminAccessCookie(res);
}

export function setSignedAthleteSessionCookie(res, athleteId) {
  appendSetCookie(
    res,
    cookie.serialize(
      ATHLETE_SESSION_COOKIE_NAME,
      createSignedValue({
        athleteId,
        issuedAt: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      }
    )
  );
}

export function clearSignedAthleteSessionCookie(res) {
  appendSetCookie(
    res,
    cookie.serialize(ATHLETE_SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}

export function setAdminAccessCookie(res, athleteId) {
  appendSetCookie(
    res,
    cookie.serialize(
      ADMIN_COOKIE_NAME,
      createSignedValue({
        athleteId,
        issuedAt: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
      }
    )
  );
}

export function clearAdminAccessCookie(res) {
  appendSetCookie(
    res,
    cookie.serialize(ADMIN_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}

export function syncAdminAccessCookie(res, athlete) {
  if (athlete?.is_admin && athlete?.id) {
    setAdminAccessCookie(res, athlete.id);
    return;
  }

  clearAdminAccessCookie(res);
}

export function getAdminAccessPayloadFromRequest(req) {
  const cookies = parseRequestCookies(req);
  return readSignedValue(cookies[ADMIN_COOKIE_NAME]);
}

export function getSignedAthleteSessionFromRequest(req) {
  const cookies = parseRequestCookies(req);
  return readSignedValue(cookies[ATHLETE_SESSION_COOKIE_NAME]);
}

export function getAuthenticatedAthleteIdFromRequest(req) {
  return getSignedAthleteSessionFromRequest(req)?.athleteId || null;
}

export async function getAdminRequestContext(req) {
  const athleteId = getAuthenticatedAthleteIdFromRequest(req);
  if (!athleteId) {
    return { authenticated: false, authorized: false, reason: 'not_authenticated' };
  }

  const adminSession = getAdminAccessPayloadFromRequest(req);
  if (!adminSession?.athleteId || adminSession.athleteId !== athleteId) {
    return { authenticated: true, authorized: false, reason: 'invalid_admin_session', athleteId };
  }

  const admin = getSupabaseAdminClient();
  const { data: athlete, error } = await admin
    .from('athletes')
    .select('id, name, email, is_admin')
    .eq('id', athleteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!athlete?.is_admin) {
    return { authenticated: true, authorized: false, reason: 'not_admin', athleteId };
  }

  return {
    authenticated: true,
    authorized: true,
    reason: 'authorized',
    athleteId,
    athlete,
  };
}

export async function requireAdminRequest(req, res) {
  try {
    const context = await getAdminRequestContext(req);
    if (context.authorized) {
      return context;
    }

    if (!context.authenticated) {
      res.status(401).json({ error: 'Not authenticated' });
      return null;
    }

    if (context.reason === 'invalid_admin_session') {
      res.status(401).json({ error: 'Admin session expired. Please log in again.' });
      return null;
    }

    res.status(403).json({ error: 'Admin access required' });
    return null;
  } catch (error) {
    console.error('[authServer] admin check failed:', error);
    res.status(500).json({ error: 'Could not verify admin access.' });
    return null;
  }
}

export async function findOrCreateAthleteForAuthUser({
  admin,
  supabaseUserId,
  email,
  name = null,
  existingAthleteId = null,
}) {
  let isNewAthlete = false;
  let { data: athlete, error: athleteLookupError } = await admin
    .from('athletes')
    .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id, is_admin')
    .eq('supabase_user_id', supabaseUserId)
    .maybeSingle();

  if (athleteLookupError) {
    throw athleteLookupError;
  }

  if (!athlete && existingAthleteId) {
    const { data: currentAthlete, error: currentAthleteError } = await admin
      .from('athletes')
      .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id, is_admin')
      .eq('id', existingAthleteId)
      .maybeSingle();

    if (currentAthleteError) {
      throw currentAthleteError;
    }

    if (currentAthlete) {
      if (currentAthlete.supabase_user_id && currentAthlete.supabase_user_id !== supabaseUserId) {
        throw new Error('This Threshold account is already linked to a different login.');
      }

      const normalizedTier = normalizeSubscriptionTier(currentAthlete.subscription_tier);
      const { data: linkedAthlete, error: linkCurrentError } = await admin
        .from('athletes')
        .update({
          supabase_user_id: supabaseUserId,
          email: currentAthlete.email || email || null,
          name: currentAthlete.name || name || null,
          subscription_tier: normalizedTier,
        })
        .eq('id', currentAthlete.id)
        .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id, is_admin')
        .single();

      if (linkCurrentError) {
        throw linkCurrentError;
      }

      athlete = linkedAthlete;
    }
  }

  if (!athlete && email) {
    const { data: emailAthlete, error: emailLookupError } = await admin
      .from('athletes')
      .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id, is_admin')
      .eq('email', email)
      .maybeSingle();

    if (emailLookupError) {
      throw emailLookupError;
    }

    if (emailAthlete) {
      if (emailAthlete.supabase_user_id && emailAthlete.supabase_user_id !== supabaseUserId) {
        throw new Error('That email is already linked to a different login.');
      }

      const normalizedTier = normalizeSubscriptionTier(emailAthlete.subscription_tier);
      const { data: linkedAthlete, error: linkError } = await admin
        .from('athletes')
        .update({
          supabase_user_id: supabaseUserId,
          email,
          name: emailAthlete.name || name || null,
          subscription_tier: normalizedTier,
        })
        .eq('id', emailAthlete.id)
        .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id, is_admin')
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
      .select('id, name, email, onboarding_complete, subscription_tier, supabase_user_id, is_admin')
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

export function getAthleteIdFromRequest(req) {
  return getAuthenticatedAthleteIdFromRequest(req);
}

export async function getAthleteByCookie(req, client) {
  const athleteId = getAuthenticatedAthleteIdFromRequest(req);
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
