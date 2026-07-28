import { getSupabaseAdminClient } from '../../lib/authServer';
import { requireLiveAthleteId } from '../../lib/auth/requireAthlete.js';
import {
  enforceAuthRateLimit,
  getClientIp,
  recordAuthAttempt,
} from '../../lib/auth/rateLimit.js';

/**
 * The athlete's side of coach linking.
 *
 * Entering a coach code used to drop the athlete straight onto that coach's
 * roster with status 'active' and no involvement from the coach at all. Coach
 * codes are short, partly derived from the coach's public name, and this
 * endpoint had no rate limiting — so the code space could be worked through
 * until it landed on a real roster.
 *
 * A code now creates a REQUEST. The coach approves it from
 * /api/coach/connection-requests, at which point both sides have agreed. The
 * write covers both link tables: coach_athlete_relationships is what actually
 * governs a coach's access to athlete data, while coach_athlete_links backs
 * the athlete-facing "my coaches" list.
 */
export default async function handler(req, res) {
  const admin = getSupabaseAdminClient();
  const athleteId = await requireLiveAthleteId(req, res, admin);
  if (!athleteId) return;

  if (req.method === 'GET') {
    const { data: links, error } = await admin
      .from('coach_athlete_links')
      .select('id, athlete_id, coach_id, role, status, created_at')
      .eq('athlete_id', athleteId)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const coachIds = (links || []).map((item) => item.coach_id);
    const { data: profiles } = coachIds.length
      ? await admin
          .from('coach_profiles')
          .select('id, display_name, coach_code, created_at')
          .in('id', coachIds)
      : { data: [] };

    res.status(200).json({
      connections: (links || []).map((link) => ({
        ...link,
        coach: (profiles || []).find((profile) => profile.id === link.coach_id) || null,
      })),
    });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const role = body.role === 'secondary' ? 'secondary' : 'primary';
    const coachCode = body.coach_code?.trim().toUpperCase();

    if (!coachCode) {
      res.status(400).json({ error: 'coach_code is required' });
      return;
    }

    // Bucketed on the athlete rather than the code, so an enumeration attempt
    // cannot be spread across many codes from a single account.
    const ip = getClientIp(req);
    if (!(await enforceAuthRateLimit(admin, res, { kind: 'coach_code', identifier: athleteId, ip }))) {
      return;
    }

    const { data: coachProfile, error: coachError } = await admin
      .from('coach_profiles')
      .select('id, athlete_id, display_name, coach_code')
      .eq('coach_code', coachCode)
      .maybeSingle();

    if (coachError || !coachProfile) {
      await recordAuthAttempt(admin, { kind: 'coach_code', identifier: athleteId, ip, succeeded: false });
      res.status(404).json({ error: 'Coach code not found' });
      return;
    }

    if (coachProfile.athlete_id === athleteId) {
      res.status(400).json({ error: 'That is your own coach code.' });
      return;
    }

    const { data: existing } = await admin
      .from('coach_athlete_links')
      .select('id, status, role')
      .eq('athlete_id', athleteId)
      .eq('coach_id', coachProfile.id)
      .in('status', ['active', 'pending'])
      .maybeSingle();

    if (existing) {
      res.status(409).json({
        error: existing.status === 'pending'
          ? 'You have already asked to join this coach. They still need to approve it.'
          : 'You are already connected to this coach.',
      });
      return;
    }

    const { data: activeRole } = await admin
      .from('coach_athlete_links')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('role', role)
      .eq('status', 'active')
      .maybeSingle();

    if (activeRole) {
      res.status(400).json({ error: `An active ${role} coach is already connected` });
      return;
    }

    const { data: link, error } = await admin
      .from('coach_athlete_links')
      .insert({
        athlete_id: athleteId,
        coach_id: coachProfile.id,
        role,
        status: 'pending',
      })
      .select('id, athlete_id, coach_id, role, status, created_at')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // The relationship row is what gates the coach's access to this athlete's
    // data, so it stays pending until the coach approves.
    const { error: relationshipError } = await admin
      .from('coach_athlete_relationships')
      .upsert(
        {
          coach_id: coachProfile.id,
          athlete_id: athleteId,
          status: 'pending',
          initiated_by: 'athlete',
        },
        { onConflict: 'coach_id,athlete_id' }
      );

    if (relationshipError) {
      // Roll the request back rather than leaving a half-made link that shows
      // in the athlete's list but can never be approved.
      await admin.from('coach_athlete_links').delete().eq('id', link.id);
      res.status(500).json({ error: relationshipError.message });
      return;
    }

    await recordAuthAttempt(admin, { kind: 'coach_code', identifier: athleteId, ip, succeeded: true });

    res.status(200).json({
      connection: { ...link, coach: coachProfile },
      message: `Request sent to ${coachProfile.display_name}. They need to approve it before they can see your training.`,
    });
    return;
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    // Scoped to the session athlete so one athlete cannot cancel another's.
    const { data: link, error: lookupError } = await admin
      .from('coach_athlete_links')
      .select('id, coach_id')
      .eq('id', id)
      .eq('athlete_id', athleteId)
      .maybeSingle();

    if (lookupError || !link) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const { error } = await admin
      .from('coach_athlete_links')
      .update({ status: 'inactive' })
      .eq('id', id)
      .eq('athlete_id', athleteId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Withdrawing consent has to revoke the coach's data access too, or
    // "Disconnect" would only tidy up the athlete's own list.
    await admin
      .from('coach_athlete_relationships')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('coach_id', link.coach_id)
      .eq('athlete_id', athleteId);

    res.status(200).json({ success: true });
    return;
  }

  res.status(405).end();
}
