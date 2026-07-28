/**
 * Durable rate limiting and lockout for the auth endpoints.
 *
 * Backed by the `auth_attempts` table rather than process memory: the app
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
 * Failures are fail-OPEN. If the database is unreachable, we let the request
 * through rather than locking every user out of the product — availability of
 * the login page matters more than a perfect limiter, and the password check
 * itself still has to pass.
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
 * Best-effort client IP. Cloudflare sets cf-connecting-ip; most other proxies
 * set x-forwarded-for, whose first entry is the original client.
 */
export function getClientIp(req) {
  const header = (name) => {
    const value = req?.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const cf = header('cf-connecting-ip');
  if (cf) return cf.trim();
  const forwarded = header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = header('x-real-ip');
  if (real) return real.trim();
  return req?.socket?.remoteAddress || null;
}

/** Emails are bucketed case-insensitively so casing can't split the counter. */
export function normalizeIdentifier(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function countRecentFailures(admin, { kind, identifier, windowMs }) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await admin
    .from('auth_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('kind', kind)
    .eq('identifier', identifier)
    .eq('succeeded', false)
    .gte('created_at', since);

  if (error) throw error;
  return count ?? 0;
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
    await admin.from('auth_attempts').insert(rows);
  } catch (error) {
    console.error('[rateLimit] could not record attempt:', error?.message);
  }
}

/**
 * Clears the failure counters for an identifier after a genuine success, so a
 * user who fumbled their password a few times isn't left near the limit.
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
 * Returns { allowed, retryAfterSeconds }. Fails open on database errors.
 */
export async function checkAuthRateLimit(admin, { kind, identifier, ip }) {
  const policy = RATE_LIMITS[kind];
  if (!policy) return { allowed: true, retryAfterSeconds: 0 };

  try {
    const checks = [];
    const normalized = normalizeIdentifier(identifier);
    if (normalized) {
      checks.push({ identifier: normalized, ...policy.identifier });
    }
    if (ip) {
      checks.push({ identifier: `ip:${ip}`, ...policy.ip });
    }

    for (const check of checks) {
      const failures = await countRecentFailures(admin, {
        kind,
        identifier: check.identifier,
        windowMs: check.windowMs,
      });
      if (failures >= check.limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(check.windowMs / 1000),
        };
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  } catch (error) {
    console.error('[rateLimit] check failed, allowing request:', error?.message);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Guard for an API handler. Writes the 429 response and returns false when the
 * caller must stop; returns true when the request may proceed.
 */
export async function enforceAuthRateLimit(admin, res, { kind, identifier, ip }) {
  const { allowed, retryAfterSeconds } = await checkAuthRateLimit(admin, { kind, identifier, ip });
  if (allowed) return true;

  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ error: RATE_LIMITED_MESSAGE });
  return false;
}
