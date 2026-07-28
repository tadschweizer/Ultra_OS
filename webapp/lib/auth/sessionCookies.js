import cookie from 'cookie';
import crypto from 'crypto';
import { AUTH_COOKIE_NAME, VIEW_AS_COOKIE_NAME, isValidAthleteId } from './contracts.js';

/**
 * Adds a Set-Cookie header without dropping any already queued on the
 * response. Exported because handlers that write several cookies must not
 * assign the header directly — doing so silently discards the others.
 */
export function appendSetCookie(res, nextCookie) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', nextCookie);
    return;
  }
  const cookies = Array.isArray(current) ? current : [current];
  res.setHeader('Set-Cookie', [...cookies, nextCookie]);
}

function getSessionSecret() {
  // SESSION_COOKIE_SECRET is preferred; the service-role key is a
  // high-entropy server-only fallback so existing deploys stay secure
  // without a new env var. Rotating either logs everyone out.
  const secret = process.env.SESSION_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('Missing SESSION_COOKIE_SECRET (or SUPABASE_SERVICE_ROLE_KEY fallback) for session signing');
  }
  return secret;
}

function hmac(value) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

// ─── Session token ───────────────────────────────────────────────────────────
// Value shape: `<athleteId>:<sessionVersion>:<expiresAtMs>.<hmac>`
//
// The previous format signed the athlete id alone, which meant the token had
// no expiry the server enforced and no way to be revoked: logging out only
// deleted the browser's copy, so a value captured from a screenshot, a log or
// a borrowed laptop stayed valid until the signing secret was rotated — which
// logs out every user on the platform at once.
//
// Two fields fix that. `expiresAtMs` is checked server-side, so the token dies
// on schedule whether or not the browser honours maxAge. `sessionVersion` is
// compared against `athletes.session_version`, so bumping that column (on a
// password change, a reset, or "sign out everywhere") invalidates every token
// already issued for that athlete.
//
// Note: this format is deliberately incompatible with the old one. Accepting
// bare `<athleteId>.<hmac>` values would keep issuing sessions that can never
// expire or be revoked, so existing sessions end and everyone signs in once
// more — the same call plan-01 made when it introduced signing.

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

// Renew the cookie once it is more than a day old rather than on every
// request, so an active user is never logged out mid-session but we are not
// writing a Set-Cookie header on every single response.
const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export function signAthleteSession(athleteId, sessionVersion = 1, expiresAtMs = Date.now() + SESSION_MAX_AGE_SEC * 1000) {
  const payload = `${athleteId}:${sessionVersion}:${expiresAtMs}`;
  return `${payload}.${hmac(payload)}`;
}

/**
 * Verifies signature and expiry. Returns { athleteId, sessionVersion,
 * expiresAtMs } or null.
 *
 * This does NOT check `session_version` against the database — that needs an
 * async query. Use `verifyAthleteSessionWithRevocation` where revocation must
 * take effect immediately.
 */
export function verifyAthleteSession(value, now = Date.now()) {
  if (!value || typeof value !== 'string') return null;
  const idx = value.lastIndexOf('.');
  if (idx === -1) return null;

  const payload = value.slice(0, idx);
  const [athleteId, versionRaw, expiresRaw] = payload.split(':');
  if (!isValidAthleteId(athleteId)) return null;

  const sessionVersion = Number(versionRaw);
  if (!Number.isInteger(sessionVersion) || sessionVersion < 1) return null;

  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return null;

  const mac = Buffer.from(value.slice(idx + 1));
  const expected = Buffer.from(hmac(payload));
  if (mac.length !== expected.length || !crypto.timingSafeEqual(mac, expected)) return null;

  return { athleteId, sessionVersion, expiresAtMs };
}

export function parseRequestCookies(req) {
  return cookie.parse(req.headers.cookie || '');
}

/** Full verified session from the request cookie, or null. */
export function getSessionFromRequest(req, now = Date.now()) {
  return verifyAthleteSession(parseRequestCookies(req)[AUTH_COOKIE_NAME], now);
}

/**
 * The verified athlete id, or null. Synchronous, so signature and expiry are
 * enforced but revocation is not — see `getAthleteIdFromRequestAsync`.
 */
export function getAthleteIdFromRequest(req) {
  return getSessionFromRequest(req)?.athleteId ?? null;
}

export function setAthleteCookie(res, athleteId, sessionVersion = 1, expiresAtMs = undefined) {
  appendSetCookie(
    res,
    cookie.serialize(AUTH_COOKIE_NAME, signAthleteSession(athleteId, sessionVersion, expiresAtMs), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SEC,
    })
  );
}

/**
 * Slides the expiry forward for an active session. No-op when the cookie was
 * issued recently, so most responses carry no Set-Cookie header.
 */
export function renewAthleteCookieIfStale(res, session, now = Date.now()) {
  if (!session) return false;
  const issuedAtMs = session.expiresAtMs - SESSION_MAX_AGE_SEC * 1000;
  if (now - issuedAtMs < SESSION_RENEW_AFTER_MS) return false;
  setAthleteCookie(res, session.athleteId, session.sessionVersion);
  return true;
}

export function clearAthleteCookie(res) {
  appendSetCookie(
    res,
    cookie.serialize(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}

// ─── Admin read-only impersonation (view_as cookie) ──────────────────────────
// The value embeds a signed expiry so a captured cookie value dies server-side
// after the window, independent of the browser honoring maxAge.

const VIEW_AS_MAX_AGE_SEC = 2 * 60 * 60;

export function signViewAsValue(athleteId, expiresAtMs = Date.now() + VIEW_AS_MAX_AGE_SEC * 1000) {
  const payload = `${athleteId}:${expiresAtMs}`;
  return `${payload}.${hmac(payload)}`;
}

export function verifyViewAsValue(value, now = Date.now()) {
  if (!value || typeof value !== 'string') return null;
  const idx = value.lastIndexOf('.');
  if (idx === -1) return null;
  const payload = value.slice(0, idx);
  const [athleteId, expiresRaw] = payload.split(':');
  if (!isValidAthleteId(athleteId)) return null;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return null;
  const mac = Buffer.from(value.slice(idx + 1));
  const expected = Buffer.from(hmac(payload));
  if (mac.length !== expected.length || !crypto.timingSafeEqual(mac, expected)) return null;
  return athleteId;
}

export function getViewAsIdFromRequest(req, now = Date.now()) {
  const raw = parseRequestCookies(req)[VIEW_AS_COOKIE_NAME];
  return verifyViewAsValue(raw, now);
}

export function setViewAsCookie(res, athleteId) {
  appendSetCookie(
    res,
    cookie.serialize(VIEW_AS_COOKIE_NAME, signViewAsValue(athleteId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: VIEW_AS_MAX_AGE_SEC,
    })
  );
}

export function clearViewAsCookie(res) {
  appendSetCookie(
    res,
    cookie.serialize(VIEW_AS_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}
