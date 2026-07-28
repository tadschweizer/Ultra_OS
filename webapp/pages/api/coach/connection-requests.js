import { getSupabaseAdminClient } from '../../../lib/authServer';
import { requireLiveAthleteId } from '../../../lib/auth/requireAthlete.js';

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
  const athleteId = await requireLiveAthleteId(req, res, admin);
  if (!athleteId) return;

  // Note this does NOT auto-create a coach profile: a coach who has never had
  // one also has no roster and therefore no requests.
  const { data: profile, error: profileError } = await admin
    .from('coach_profiles')
    .select('id, display_name')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (profileError) {
    res.status(500).json({ error: profileError.message });
    return;
  }
  if (!profile) {
    res.status(200).json({ requests: [] });
    return;
  }

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
