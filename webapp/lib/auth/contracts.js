export const AUTH_COOKIE_NAME = 'athlete_id';

export const AUTH_ERROR_MESSAGES = Object.freeze({
  INVALID_CREDENTIALS: 'Invalid email or password.',
  LOGIN_PROFILE_SYNC_FAILED: 'Login succeeded but profile setup failed. Please try again.',
  MISSING_ACCESS_TOKEN: 'Missing access token.',
  INVALID_SESSION_TOKEN: 'Invalid or expired session token.',
  SESSION_SYNC_FAILED: 'Could not finish sign-in. Please try again.',
  SIGNUP_FAILED: 'Could not create account. Please try again.',
  DUPLICATE_ACCOUNT: 'An account with that email already exists. Try logging in instead.',
  SIGNUP_PROFILE_FAILED: 'Could not create athlete profile. Please try again.',
});

export const AUTH_STATUS = Object.freeze({
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  SERVER_ERROR: 500,
});

export const isValidAthleteId = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

export function assertAuthPostMethod(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}
