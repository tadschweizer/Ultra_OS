import { clearAthleteCookie, clearViewAsCookie } from '../../../lib/auth/sessionCookies.js';
import { assertAuthPostMethod } from '../../../lib/auth/contracts.js';

/**
 * Ends the session on this device.
 *
 * `view_as` is cleared too: it used to survive logout, so an admin who was
 * impersonating, signed out and signed back in landed straight back inside the
 * other athlete's account with no indication they had.
 *
 * To end sessions on OTHER devices see POST /api/auth/sign-out-everywhere —
 * clearing a cookie only affects the browser holding it.
 */
export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  clearAthleteCookie(res);
  clearViewAsCookie(res);
  res.status(200).json({ ok: true });
}
