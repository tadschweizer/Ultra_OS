import { getSupabaseAdminClient } from '../../../lib/authServer';
import { requireCoachAccess } from '../../../lib/auth/roleAccessServer.js';

/**
 * The coach's side of coach linking — the approval step that did not exist.
 *
 * GET  → athletes who have asked to join this coach's roster.
 * POST → { id, action: 'approve' | 'decline' }
 *
 * Only requests the ATHLETE started can be approved here. A coach-initiated
 * invitation is the athlete's to accept (see accept-invitation.js); letting a
 * coach approve their own invitation would put someone on a roster without
 * that person ever agreeing.
 */
export default async function handler(req, res) {
  const admin = getSupabaseAdminClient();
  const access = await requireCoachAccess(req, res, admin);
  if (!access) return;
  const profile = access.profile;

  if (req.method === 'GET') {
    const { data: pending, error } = await admin
      .from('coach_athlete_relationships')
      .select('id, athlete_id, status, invited_at, initiated_by')
      .eq('coach_id', profile.id)
      .eq('status', 'pending')
      .eq('initiated_by', 'athlete')
      .order('invited_at', { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const athleteIds = (pending || []).map((row) => row.athlete_id);
    const { data: athletes } = athleteIds.length
      ? await admin.from('athletes').select('id, name, email').in('id', athleteIds)
      : { data: [] };

    res.status(200).json({
      requests: (pending || []).map((row) => ({
        ...row,
        athlete: (athletes || []).find((a) => a.id === row.athlete_id) || null,
      })),
    });
    return;
  }

  if (req.method === 'POST') {
    const { id, action } = req.body || {};
    if (!id || !['approve', 'decline'].includes(action)) {
      res.status(400).json({ error: "id and action ('approve' or 'decline') are required" });
      return;
    }

    // Scoped to this coach's own profile so a request cannot be approved on
    // someone else's behalf by guessing an id.
    const { data: request, error: lookupError } = await admin
      .from('coach_athlete_relationships')
      .select('id, athlete_id, status, initiated_by')
      .eq('id', id)
      .eq('coach_id', profile.id)
      .eq('status', 'pending')
      .eq('initiated_by', 'athlete')
      .maybeSingle();

    if (lookupError || !request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const approved = action === 'approve';
    const now = new Date().toISOString();

    const { error: updateError } = await admin
      .from('coach_athlete_relationships')
      .update(
        approved
          ? { status: 'active', accepted_at: now }
          : { status: 'removed', removed_at: now }
      )
      .eq('id', request.id);

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    // Keep the athlete-facing list in step with the decision.
    await admin
      .from('coach_athlete_links')
      .update({ status: approved ? 'active' : 'inactive' })
      .eq('coach_id', profile.id)
      .eq('athlete_id', request.athlete_id)
      .eq('status', 'pending');

    res.status(200).json({ ok: true, status: approved ? 'active' : 'declined' });
    return;
  }

  res.status(405).end();
}
