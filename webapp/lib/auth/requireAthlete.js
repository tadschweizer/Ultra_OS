import {
  getAthleteIdFromRequest,
  getSessionFromRequest,
  getViewAsIdFromRequest,
} from './sessionCookies.js';
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
 * Like `getAthleteIdFromRequest`, but additionally checks the token's
 * `sessionVersion` against `athletes.session_version` — so a password change,
 * a reset, or "sign out everywhere" takes effect immediately instead of when
 * the token expires.
 *
 * Deliberately named differently from the synchronous version rather than
 * making that one async: a forgotten `await` would return a Promise, which is
 * truthy, and would turn a missing keyword into an authentication bypass. A
 * distinct name means existing synchronous call sites keep working correctly
 * and can be migrated one at a time.
 *
 * Fails CLOSED — if the athlete row cannot be read, no id is returned.
 */
export async function getAthleteIdFromRequestAsync(req, adminClient = null) {
  const session = getSessionFromRequest(req);
  if (!session) return null;

  const client = adminClient || getSupabaseAdminClient();
  const { data: athlete, error } = await client
    .from('athletes')
    .select('session_version')
    .eq('id', session.athleteId)
    .maybeSingle();

  if (error || !athlete) return null;
  if (Number(athlete.session_version || 1) !== session.sessionVersion) return null;

  return session.athleteId;
}

/**
 * Async guard that honours session revocation. Writes the 401 and returns null
 * when the caller must stop.
 */
export async function requireLiveAthleteId(req, res, adminClient = null) {
  const athleteId = await getAthleteIdFromRequestAsync(req, adminClient);
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
  const none = { athleteId: null, realAthleteId: null, isImpersonating: false, session: null };

  const session = getSessionFromRequest(req);
  if (!session) return none;

  const realAthleteId = session.athleteId;
  const client = adminClient || getSupabaseAdminClient();

  // One read covers both the revocation check and the admin check below.
  const { data: me, error } = await client
    .from('athletes')
    .select('is_admin, session_version')
    .eq('id', realAthleteId)
    .maybeSingle();

  // Fail closed: an unreadable or missing athlete row is not a session.
  if (error || !me) return none;
  if (Number(me.session_version || 1) !== session.sessionVersion) return none;

  const self = { athleteId: realAthleteId, realAthleteId, isImpersonating: false, session };
  if (req.method !== 'GET') return self;

  const targetId = getViewAsIdFromRequest(req);
  if (!targetId || targetId === realAthleteId) return self;

  if (!me.is_admin) return self;

  return { athleteId: targetId, realAthleteId, isImpersonating: true, session };
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
