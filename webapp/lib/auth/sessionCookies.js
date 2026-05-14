import cookie from 'cookie';
import { AUTH_COOKIE_NAME } from './contracts.js';

function appendSetCookie(res, nextCookie) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', nextCookie);
    return;
  }
  const cookies = Array.isArray(current) ? current : [current];
  res.setHeader('Set-Cookie', [...cookies, nextCookie]);
}

export function parseRequestCookies(req) {
  return cookie.parse(req.headers.cookie || '');
}

export function getAthleteIdFromRequest(req) {
  return parseRequestCookies(req)[AUTH_COOKIE_NAME] || null;
}

export function setAthleteCookie(res, athleteId) {
  appendSetCookie(
    res,
    cookie.serialize(AUTH_COOKIE_NAME, athleteId, {
      httpOnly: false,
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
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}
