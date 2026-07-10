import cookie from 'cookie';
import crypto from 'crypto';
import { AUTH_COOKIE_NAME, isValidAthleteId } from './contracts.js';

function appendSetCookie(res, nextCookie) {
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

export function signAthleteId(athleteId) {
  return `${athleteId}.${hmac(athleteId)}`;
}

export function verifySignedAthleteId(value) {
  if (!value || typeof value !== 'string') return null;
  const idx = value.lastIndexOf('.');
  if (idx === -1) return null;
  const athleteId = value.slice(0, idx);
  if (!isValidAthleteId(athleteId)) return null;
  const mac = Buffer.from(value.slice(idx + 1));
  const expected = Buffer.from(hmac(athleteId));
  if (mac.length !== expected.length || !crypto.timingSafeEqual(mac, expected)) return null;
  return athleteId;
}

export function parseRequestCookies(req) {
  return cookie.parse(req.headers.cookie || '');
}

export function getAthleteIdFromRequest(req) {
  const raw = parseRequestCookies(req)[AUTH_COOKIE_NAME];
  return verifySignedAthleteId(raw);
}

export function setAthleteCookie(res, athleteId) {
  appendSetCookie(
    res,
    cookie.serialize(AUTH_COOKIE_NAME, signAthleteId(athleteId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  );
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
