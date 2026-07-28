import { bumpSessionVersion, getSupabaseAdminClient } from '../../../lib/authServer';
import { clearAthleteCookie, clearViewAsCookie } from '../../../lib/auth/sessionCookies.js';
import { assertAuthPostMethod, AUTH_STATUS } from '../../../lib/auth/contracts.js';
import { requireLiveAthleteId } from '../../../lib/auth/requireAthlete.js';

/**
 * POST /api/auth/sign-out-everywhere
 *
 * Ends every session for this athlete, on every device, including this one.
 *
 * Plain logout can only delete the cookie in the browser making the request —
 * it has no reach over a session on a phone left behind, or over a cookie
 * value someone copied. Bumping `session_version` invalidates the signature of
 * every token already issued, so they all stop verifying at once.
 */
export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const admin = getSupabaseAdminClient();
  const athleteId = await requireLiveAthleteId(req, res, admin);
  if (!athleteId) return;

  try {
    await bumpSessionVersion(admin, athleteId);
  } catch (error) {
    console.error('[sign-out-everywhere] failed:', error?.message);
    res.status(AUTH_STATUS.SERVER_ERROR).json({ error: 'Could not sign out your other devices. Try again.' });
    return;
  }

  clearAthleteCookie(res);
  clearViewAsCookie(res);
  res.status(200).json({ ok: true });
}
