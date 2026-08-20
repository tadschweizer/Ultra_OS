import cookie from 'cookie';
import crypto from 'crypto';
import { safeNextPath } from './redirects.js';

/**
 * OAuth `state` — CSRF protection for the authorization-code flow.
 *
 * Without it, an attacker can complete an authorization on their own account,
 * hold the resulting `code`, and then trick a signed-in victim into loading
 * the callback URL. The callback happily exchanges the code and attaches the
 * ATTACKER's Strava account to the VICTIM's Threshold account — after which
 * the attacker's activity data flows into someone else's training history. Run
 * the other way (victim's code, attacker's session) it hands the attacker the
 * victim's Strava tokens.
 *
 * `/api/strava/login` previously sent no `state` at all and the connectors
 * sent a static, guessable string (`provider:oura`), so both directions were
 * open. The fix is the standard one: mint a random nonce, keep it in a
 * short-lived httpOnly cookie, and require the callback to echo it back.
 *
 * The nonce is stored per provider so starting a Garmin link does not
 * invalidate a Strava link opened in another tab.
 */

const STATE_COOKIE_PREFIX = 'oauth_state_';
const RETURN_COOKIE_PREFIX = 'oauth_return_';

// Long enough to finish a provider consent screen, short enough that a stale
// nonce is not lying around. Matches the pending-invite cookie's window.
const STATE_MAX_AGE_SEC = 30 * 60;

function stateCookieName(provider) {
  return `${STATE_COOKIE_PREFIX}${String(provider).replace(/[^a-z0-9_]/gi, '')}`;
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
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

/** Mints a nonce, stores it in an httpOnly cookie, and returns it. */
export function createOAuthState(res, provider) {
  const state = crypto.randomBytes(32).toString('base64url');
  appendSetCookie(
    res,
    cookie.serialize(stateCookieName(provider), state, cookieOptions(STATE_MAX_AGE_SEC))
  );
  return state;
}

/**
 * Compares the `state` echoed by the provider against the cookie, in constant
 * time. Returns true only on an exact match — a missing cookie or a missing
 * query parameter is a failure, never a pass.
 */
export function verifyOAuthState(req, provider, providedState) {
  if (!providedState || typeof providedState !== 'string') return false;

  const expected = cookie.parse(req.headers.cookie || '')[stateCookieName(provider)];
  if (!expected) return false;

  const a = Buffer.from(providedState);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Burns the nonce so a callback URL cannot be replayed. */
export function clearOAuthState(res, provider) {
  appendSetCookie(res, cookie.serialize(stateCookieName(provider), '', cookieOptions(0)));
}

export function setOAuthReturnPath(res, provider, rawPath) {
  const path = safeNextPath(rawPath, '');
  if (!path) return;
  const name = `${RETURN_COOKIE_PREFIX}${String(provider).replace(/[^a-z0-9_]/gi, '')}`;
  appendSetCookie(res, cookie.serialize(name, path, cookieOptions(STATE_MAX_AGE_SEC)));
}

export function consumeOAuthReturnPath(req, res, provider) {
  const name = `${RETURN_COOKIE_PREFIX}${String(provider).replace(/[^a-z0-9_]/gi, '')}`;
  const rawPath = cookie.parse(req.headers.cookie || '')[name];
  appendSetCookie(res, cookie.serialize(name, '', cookieOptions(0)));
  return safeNextPath(rawPath, '');
}
