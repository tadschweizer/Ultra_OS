import { getAthleteIdFromRequest, getViewAsIdFromRequest } from './sessionCookies.js';
import { getSupabaseAdminClient } from '../authServer.js';

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
 * Resolves the EFFECTIVE athlete id for data reads, honoring admin read-only
 * impersonation (the signed `view_as` cookie):
 *
 * - No session → { athleteId: null }.
 * - No valid view_as cookie → the real session athlete.
 * - view_as present on a GET: is_admin is re-verified against the database on
 *   EVERY request (admins can be demoted mid-session) before returning the
 *   target id. Non-admins with a validly signed cookie are treated as self.
 * - Non-GET methods NEVER resolve to the target — writes during impersonation
 *   are additionally blocked outright by middleware.js.
 */
export async function resolveEffectiveAthleteId(req, adminClient = null) {
  const realAthleteId = getAthleteIdFromRequest(req);
  if (!realAthleteId) return { athleteId: null, realAthleteId: null, isImpersonating: false };

  const self = { athleteId: realAthleteId, realAthleteId, isImpersonating: false };
  if (req.method !== 'GET') return self;

  const targetId = getViewAsIdFromRequest(req);
  if (!targetId || targetId === realAthleteId) return self;

  const client = adminClient || getSupabaseAdminClient();
  const { data: me, error } = await client
    .from('athletes')
    .select('is_admin')
    .eq('id', realAthleteId)
    .maybeSingle();
  if (error || !me?.is_admin) return self;

  return { athleteId: targetId, realAthleteId, isImpersonating: true };
}

/**
 * Drop-in async replacement for getAthleteIdFromRequest on GET data routes:
 * returns the effective athlete id (impersonation-aware), or null.
 */
export async function getEffectiveAthleteIdFromRequest(req, adminClient = null) {
  const resolved = await resolveEffectiveAthleteId(req, adminClient);
  return resolved.athleteId;
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
