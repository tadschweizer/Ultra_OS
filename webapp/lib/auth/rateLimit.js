import crypto from 'node:crypto';
import { isIP } from 'node:net';
/**
 * Durable rate limiting and lockout for the auth endpoints.
 *
 * Backed by atomic `auth_rate_buckets` reservations rather than process memory: the app
 * runs on serverless (Cloudflare Pages / Vercel), where an in-memory counter
 * resets on every cold start and is never shared between instances — which
 * makes it useless against exactly the distributed guessing it is meant to
 * stop.
 *
 * Two buckets are checked for every attempt:
 *   - per identifier (the email being targeted), which stops someone
 *     grinding one account from many addresses; and
 *   - per IP, which stops one host spraying many accounts.
 *
 * Requests reserve atomic database counters before provider work. Errors fail closed.
 */

export const RATE_LIMITS = Object.freeze({
  login: {
    identifier: { limit: 8, windowMs: 15 * 60 * 1000 },
    ip: { limit: 40, windowMs: 15 * 60 * 1000 },
  },
  signup: {
    identifier: { limit: 5, windowMs: 60 * 60 * 1000 },
    ip: { limit: 15, windowMs: 60 * 60 * 1000 },
  },
  password_reset: {
    identifier: { limit: 5, windowMs: 60 * 60 * 1000 },
    ip: { limit: 20, windowMs: 60 * 60 * 1000 },
  },
  password_change: {
    identifier: { limit: 10, windowMs: 60 * 60 * 1000 },
    ip: { limit: 20, windowMs: 60 * 60 * 1000 },
  },
  coach_code: {
    identifier: { limit: 10, windowMs: 60 * 60 * 1000 },
    ip: { limit: 20, windowMs: 60 * 60 * 1000 },
  },
});

export const RATE_LIMITED_MESSAGE =
  'Too many attempts. Wait a few minutes and try again.';

/**
 * Trust only the known deployment proxy; local requests use their socket IP.
 */
export function getClientIp(req, env = process.env) {
  // Vercel overwrites x-forwarded-for. Do not trust arbitrary Cloudflare headers
  // on a directly reachable Vercel deployment or untrusted forwarded headers locally.
  const candidate = env.VERCEL === '1' ? req?.headers?.['x-forwarded-for'] : req?.socket?.remoteAddress;
  const value = typeof candidate === 'string' ? candidate.split(',')[0].trim() : '';
  return isIP(value) ? value : null;
}
/** Emails are bucketed case-insensitively so casing can't split the counter. */
export function normalizeIdentifier(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Records one attempt. Never throws — a failed audit write must not take down
 * the login endpoint.
 */
export async function recordAuthAttempt(admin, { kind, identifier, ip, succeeded = false }) {
  try {
    const rows = [];
    const normalized = normalizeIdentifier(identifier);
    if (normalized) rows.push({ kind, identifier: normalized, ip: ip || null, succeeded });
    if (ip) rows.push({ kind, identifier: `ip:${ip}`, ip, succeeded });
    if (!rows.length) return;
    const { error } = await admin.from('auth_attempts').insert(rows);
    if (error) throw error;
  } catch (error) {
    console.error('[rateLimit] could not record attempt:', error?.message);
  }
}

/**
 * Clears legacy failure audit rows after success. Atomic request reservations
 * intentionally remain until expiry, so success cannot reset the abuse budget.
 */
export async function clearAuthAttempts(admin, { kind, identifier, ip }) {
  try {
    const normalized = normalizeIdentifier(identifier);
    if (normalized) {
      await admin
        .from('auth_attempts')
        .delete()
        .eq('kind', kind)
        .eq('identifier', normalized)
        .eq('succeeded', false);
    }
    if (ip) {
      await admin
        .from('auth_attempts')
        .delete()
        .eq('kind', kind)
        .eq('identifier', `ip:${ip}`)
        .eq('succeeded', false);
    }
  } catch (error) {
    console.error('[rateLimit] could not clear attempts:', error?.message);
  }
}

/**
 * Returns { allowed, retryAfterSeconds }. Fails closed on database errors.
 */
export async function checkAuthRateLimit(admin, { kind, identifier, ip }) {
  const policy = RATE_LIMITS[kind];
  if (!policy) return { allowed: false, unavailable: true, retryAfterSeconds: 60 };
  try {
    const buckets = [{ value: `ip:${ip || 'unknown'}`, ...policy.ip }];
    const normalized = normalizeIdentifier(identifier);
    if (normalized) buckets.push({ value: `identifier:${normalized}`, ...policy.identifier });
    for (const bucket of buckets) {
      const { data, error } = await admin.rpc('consume_auth_rate_limit', {
        p_key: crypto.createHash('sha256').update(`${kind}:${bucket.value}`).digest('hex'),
        p_limit: bucket.limit, p_window_seconds: bucket.windowMs / 1000,
      });
      if (error || typeof data !== 'boolean') throw new Error('Rate limiter unavailable');
      if (!data) return { allowed: false, retryAfterSeconds: bucket.windowMs / 1000 };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    console.error('[rateLimit] limiter unavailable; request rejected');
    return { allowed: false, unavailable: true, retryAfterSeconds: 60 };
  }
}
/**
 * Guard for an API handler. Writes the 429 response and returns false when the
 * caller must stop; returns true when the request may proceed.
 */
export async function enforceAuthRateLimit(admin, res, { kind, identifier, ip }) {
  const { allowed, unavailable, retryAfterSeconds } = await checkAuthRateLimit(admin, { kind, identifier, ip });
  if (allowed) return true;

  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(unavailable ? 503 : 429).json({ error: unavailable ? 'Sign-in protection is temporarily unavailable. Please retry.' : RATE_LIMITED_MESSAGE });
  return false;
}
