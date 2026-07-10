import { getAthleteIdFromRequest } from './sessionCookies.js';

/**
 * Returns the verified athlete id from the signed session cookie, or null.
 * When null, the 401 response has already been written — callers must
 * `return` immediately.
 */
export function requireAthleteId(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return athleteId;
}

/**
 * Verifies the session athlete exists and has is_admin set. Returns the
 * athlete id, or null after writing a 401/403 response.
 */
export async function requireAdminAthleteId(req, res, adminClient) {
  const athleteId = requireAthleteId(req, res);
  if (!athleteId) return null;

  const { data: me, error } = await adminClient
    .from('athletes')
    .select('is_admin')
    .eq('id', athleteId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  if (!me?.is_admin) {
    res.status(403).json({ error: 'Admin only' });
    return null;
  }
  return athleteId;
}
