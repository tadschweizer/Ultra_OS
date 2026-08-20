/**
 * Validation for the `?next=` parameter used to return someone to the page
 * they were trying to reach before being asked to log in.
 *
 * OnboardingGate has always appended `?next=<path>` when it bounces a signed-
 * out visitor, but the login and signup pages ignored it and sent everyone to
 * /dashboard — so every deep link, shared URL and email link lost its
 * destination.
 *
 * Honouring the parameter means validating it. An unchecked redirect target is
 * an open redirect: `/login?next=https://evil.example/login` produces a link
 * on the real domain that lands on someone else's copy of the sign-in form.
 * Only same-site absolute paths are accepted.
 */

// Auth screens are excluded so a bounce cannot loop the user back to login.
const BLOCKED_PREFIXES = ['/login', '/signup', '/auth/', '/forgot-password', '/reset-password'];

export function safeNextPath(rawNext, fallback = '/dashboard') {
  if (!rawNext || typeof rawNext !== 'string') return fallback;

  // Must be a site-relative path. `//evil.example` is protocol-relative and
  // would leave the site, and `/\evil.example` is treated the same way by some
  // browsers — both start with a slash, so checking the second character too
  // is what makes this safe.
  if (!rawNext.startsWith('/')) return fallback;
  if (rawNext.startsWith('//') || rawNext.startsWith('/\\')) return fallback;

  // A backslash or control character anywhere is not something our own links
  // produce, and both are used to confuse URL parsers.
  if (/[\\\u0000-\u001f\u007f]/.test(rawNext)) return fallback;

  const path = rawNext.split(/[?#]/)[0];
  if (BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) {
    return fallback;
  }

  return rawNext;
}

export function isCoachInvitationPath(path) {
  if (!path || typeof path !== 'string') return false;
  try {
    const url = new URL(path, 'https://mythreshold.co');
    return url.origin === 'https://mythreshold.co'
      && url.pathname === '/join'
      && Boolean(url.searchParams.get('coach_invite'));
  } catch {
    return false;
  }
}
