import { getSupabaseAdminClient } from '../../../lib/authServer';
import { buildCoachSeatSnapshot, assertCoachSeatAvailable, coachSubscriptionHasAccess } from '../../../lib/coachBilling';
import { ensureCoachProfile, getAuthenticatedAthlete } from '../../../lib/coachServer';

async function buildRelationshipList(admin, profile) {
  const { data: relationships, error } = await admin
    .from('coach_athlete_relationships')
    .select('id, athlete_id, status, invited_at, accepted_at, removed_at, group_name, notes, created_at')
    .eq('coach_id', profile.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const athleteIds = (relationships || []).map((item) => item.athlete_id);
  let athletes = [];
  let lastLogs = [];
  let upcomingRaces = [];

  if (athleteIds.length) {
    const [athleteRes, interventionRes, raceRes] = await Promise.all([
      admin
        .from('athletes')
        .select('id, name, email, primary_sports, target_race_id')
        .in('id', athleteIds),
      admin
        .from('interventions')
        .select('athlete_id, date, inserted_at')
        .in('athlete_id', athleteIds)
        .order('inserted_at', { ascending: false }),
      admin
        .from('races')
        .select('id, athlete_id, name, event_date, race_type, distance_miles')
        .in('athlete_id', athleteIds)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .order('event_date', { ascending: true }),
    ]);

    athletes = athleteRes.data || [];
    lastLogs = interventionRes.data || [];
    upcomingRaces = raceRes.data || [];
  }

  return (relationships || []).map((relationship) => {
    const athlete = athletes.find((item) => item.id === relationship.athlete_id) || null;
    const lastLog = lastLogs.find((item) => item.athlete_id === relationship.athlete_id) || null;
    const nextRace = upcomingRaces.find((item) => item.athlete_id === relationship.athlete_id) || null;

    const lastLogDate = lastLog?.date || lastLog?.inserted_at?.slice(0, 10) || null;
    const daysSinceLog = lastLogDate
      ? Math.floor((Date.now() - new Date(lastLogDate).getTime()) / 86400000)
      : null;

    let alertLevel = 'green';
    if (daysSinceLog === null || daysSinceLog >= 7) alertLevel = 'red';
    else if (daysSinceLog >= 4) alertLevel = 'yellow';

    return {
      ...relationship,
      athlete,
      lastLogDate,
      daysSinceLog,
      nextRace,
      alertLevel,
    };
  });
}

async function getCoachContext(req, res) {
  const athlete = await getAuthenticatedAthlete(req);
  if (!athlete) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }

  const admin = getSupabaseAdminClient();
  const profile = await ensureCoachProfile(admin, athlete);
  if (!coachSubscriptionHasAccess(profile)) {
    res.status(403).json({ error: 'Coach subscription required.' });
    return null;
  }

  return { athlete, admin, profile };
}

export default async function handler(req, res) {
  try {
    const context = await getCoachContext(req, res);
    if (!context) return;

    const { admin, profile } = context;

    if (req.method === 'GET') {
      const relationships = await buildRelationshipList(admin, profile);
      const seats = await buildCoachSeatSnapshot(admin, profile);
      res.status(200).json({ relationships, profile, seats });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.athlete_id) {
        res.status(400).json({ error: 'athlete_id is required' });
        return;
      }

      if ((body.status || 'active') === 'active') {
        try {
          await assertCoachSeatAvailable(admin, profile, { allowExistingAthleteId: body.athlete_id });
        } catch (error) {
          const seatSnapshot = error.seatSnapshot || await buildCoachSeatSnapshot(admin, profile);
          res.status(error.statusCode || 409).json({
            error: error.message || 'Coach seat limit reached.',
            seatSnapshot,
          });
          return;
        }
      }

      const { data, error } = await admin
        .from('coach_athlete_relationships')
        .insert({
          coach_id: profile.id,
          athlete_id: body.athlete_id,
          status: body.status || 'active',
          group_name: body.group_name || null,
          notes: body.notes || null,
          accepted_at: body.status === 'active' || !body.status ? new Date().toISOString() : null,
        })
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ relationship: data, profile });
      return;
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (!body.id) {
        res.status(400).json({ error: 'id is required' });
        return;
      }

      const { data: existing, error: existingError } = await admin
        .from('coach_athlete_relationships')
        .select('id, athlete_id, status')
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!existing) {
        res.status(404).json({ error: 'Relationship not found.' });
        return;
      }

      if (body.status === 'active' && existing.status !== 'active') {
        try {
          await assertCoachSeatAvailable(admin, profile, { allowExistingAthleteId: existing.athlete_id });
        } catch (error) {
          const seatSnapshot = error.seatSnapshot || await buildCoachSeatSnapshot(admin, profile);
          res.status(error.statusCode || 409).json({
            error: error.message || 'Coach seat limit reached.',
            seatSnapshot,
          });
          return;
        }
      }

      const updates = {};
      if (body.status !== undefined) {
        updates.status = body.status;
        if (body.status === 'active' && !body.keep_accepted_at) {
          updates.accepted_at = new Date().toISOString();
        }
        if (body.status === 'removed') {
          updates.removed_at = new Date().toISOString();
        }
      }
      if (body.group_name !== undefined) updates.group_name = body.group_name;
      if (body.notes !== undefined) updates.notes = body.notes;

      const { data, error } = await admin
        .from('coach_athlete_relationships')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ relationship: data });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) {
        res.status(400).json({ error: 'id is required' });
        return;
      }

      const { error } = await admin
        .from('coach_athlete_relationships')
        .update({ status: 'removed', removed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('coach_id', profile.id);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error('[coach/relationships] failed:', error);
    res.status(500).json({ error: error.message });
  }
}
