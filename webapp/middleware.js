import { NextResponse } from 'next/server';

/**
 * Admin read-only impersonation guard.
 *
 * While a validly signed `view_as` cookie is present, EVERY mutating API call
 * is rejected here — one choke point instead of trusting ~50 routes to check.
 * Writes during impersonation are the whole risk: routed to the target they
 * corrupt the athlete's data, routed to the admin they corrupt the admin's.
 *
 * Exemptions: stopping impersonation and auth/logout must keep working.
 * A cookie that fails signature/expiry verification is ignored entirely so a
 * hand-crafted `view_as` value has zero effect.
 */

const VIEW_AS_COOKIE_NAME = 'view_as';

const encoder = new TextEncoder();

async function hmacBase64url(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Mirrors verifyViewAsValue in lib/auth/sessionCookies.js: `${id}:${exp}.${mac}`.
async function isValidViewAsCookie(value, secret) {
  const idx = value.lastIndexOf('.');
  if (idx === -1) return false;
  const payload = value.slice(0, idx);
  const [athleteId, expiresRaw] = payload.split(':');
  if (!athleteId || !/^[0-9a-f-]{36}$/i.test(athleteId)) return false;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;
  const expected = await hmacBase64url(secret, payload);
  return constantTimeEqual(expected, value.slice(idx + 1));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isReadMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';

  // Billing routes are blocked in BOTH directions while impersonating —
  // /api/billing/portal is a GET redirect that creates a Stripe session.
  if (isReadMethod && !pathname.startsWith('/api/billing/')) {
    return NextResponse.next();
  }

  // Exiting impersonation and logging out must always work.
  if (pathname === '/api/admin/impersonate' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const raw = req.cookies.get(VIEW_AS_COOKIE_NAME)?.value;
  if (!raw) return NextResponse.next();

  const secret = process.env.SESSION_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return NextResponse.next();

  const valid = await isValidViewAsCookie(raw, secret);
  if (!valid) return NextResponse.next();

  return NextResponse.json(
    { error: 'Read-only impersonation — exit "View as athlete" to make changes.' },
    { status: 403 }
  );
}

export const config = { matcher: '/api/:path*' };
