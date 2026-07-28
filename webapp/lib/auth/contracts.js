export const AUTH_COOKIE_NAME = 'athlete_id';
export const VIEW_AS_COOKIE_NAME = 'view_as';

export const AUTH_ERROR_MESSAGES = Object.freeze({
  INVALID_CREDENTIALS: 'Invalid email or password.',
  LOGIN_PROFILE_SYNC_FAILED: 'Login succeeded but profile setup failed. Please try again.',
  MISSING_ACCESS_TOKEN: 'Missing access token.',
  INVALID_SESSION_TOKEN: 'Invalid or expired session token.',
  SESSION_SYNC_FAILED: 'Could not finish sign-in. Please try again.',
  SIGNUP_FAILED: 'Could not create account. Please try again.',
  DUPLICATE_ACCOUNT: 'An account with that email already exists. Try logging in instead.',
  SIGNUP_PROFILE_FAILED: 'Could not create athlete profile. Please try again.',
  // Someone signed up with Google or Strava and is now trying a password.
  // Naming the provider is not a disclosure risk — they already proved they
  // know the address by reaching this branch — and it saves a support ticket.
  OAUTH_ONLY_ACCOUNT: 'That account signs in with Google or Strava. Use the buttons below, or set a password with "Forgot password".',
  RESET_LINK_INVALID: 'That reset link has expired or was already used. Request a new one.',
  CURRENT_PASSWORD_WRONG: 'Your current password is not correct.',
  PASSWORD_CHANGE_UNAVAILABLE: 'This account has no password to change. It signs in with Google or Strava.',
});

export const AUTH_STATUS = Object.freeze({
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  SERVER_ERROR: 500,
});

export const isValidAthleteId = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

// ─── Password policy ─────────────────────────────────────────────────────────
// One definition shared by the signup page, the signup API, the reset flow and
// the change-password endpoint, so the client and the server can never drift.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

// Length does far more work than character-class rules, so the bar is a longer
// minimum plus a block on the handful of passwords that are always guessed
// first. No composition requirements — they push people toward "Passw0rd!".
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', '12345678', '123456789',
  '1234567890', 'qwertyuiop', 'letmein123', 'iloveyou1', 'welcome123',
  'admin12345', 'threshold1', 'threshold123', 'changeme123', 'football123',
]);

/**
 * Returns null when the password is acceptable, or a user-facing message
 * explaining what to fix.
 */
export function validatePassword(password, { email = '' } = {}) {
  if (typeof password !== 'string' || !password) {
    return 'Enter a password.';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    return 'That password is too common. Pick something harder to guess.';
  }
  // A password that is just the email (or its local part) is effectively public.
  const localPart = String(email || '').split('@')[0].toLowerCase();
  if (localPart.length >= 3 && lowered.includes(localPart)) {
    return 'Password cannot contain your email address.';
  }
  if (/^(.)\1+$/.test(password)) {
    return 'Password cannot be a single repeated character.';
  }
  return null;
}

/** Rough 0–4 strength score for the signup meter. Advisory only. */
export function scorePassword(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

export function assertAuthPostMethod(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}
