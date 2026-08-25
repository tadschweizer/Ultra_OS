import cookie from 'cookie';
import { isCoachInvitationPath, safeNextPath } from './redirects.js';
import {
  isValidSignupRole,
  primaryRoleForSignupRole,
} from './roleGuards.js';

const COOKIE_NAME = 'signup_role_intent';
const MAX_AGE_SEC = 24 * 60 * 60;

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

function appendSetCookie(res, value) {
  const current = res.getHeader('Set-Cookie');
  const values = current ? (Array.isArray(current) ? current : [current]) : [];
  res.setHeader('Set-Cookie', [...values, value]);
}

export function normalizeSignupRoleIntent(rawRole, rawNext = '') {
  const nextPath = safeNextPath(rawNext, '');
  if (isCoachInvitationPath(nextPath)) return 'athlete-with-coach';
  return isValidSignupRole(rawRole) ? rawRole : null;
}

export function setSignupRoleIntent(res, role) {
  if (!isValidSignupRole(role)) return false;
  appendSetCookie(res, cookie.serialize(COOKIE_NAME, role, cookieOptions(MAX_AGE_SEC)));
  return true;
}

export function getSignupRoleIntent(req) {
  const role = cookie.parse(req.headers?.cookie || '')[COOKIE_NAME];
  return isValidSignupRole(role) ? role : null;
}

export function clearSignupRoleIntent(res) {
  appendSetCookie(res, cookie.serialize(COOKIE_NAME, '', cookieOptions(0)));
}

export function getPersistedPrimaryRoleIntent(req) {
  const role = getSignupRoleIntent(req);
  return role ? primaryRoleForSignupRole(role) : null;
}
