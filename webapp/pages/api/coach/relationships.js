import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';
import { buildLoadMetrics, buildLoadStatus } from '../../../lib/loadRollups';

export const runtime = 'edge';

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();

  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('coach_profiles')
    .insert({
      athlete_id: athleteId,
      display_name: athlete?.name || 'Coach',
      coach_code: generateCoachCode(athlete?.name || 'Coach'),
    })
    .select('id, athlete_id, display_name, coach_code')
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

    // ── GET: list all relationships with enriched athlete data ──────────────
    if (req.method === 'GET') {
      const { data: relationships, error } = await supabase
        .from('coach_athlete_relationships')
        .select('id, athlete_id, status, invited_at, accepted_at, removed_at, group_name, notes, created_at')
        .eq('coach_id', profile.id)
        .order('created_at', { ascending: true });

      if (error) { res.status(500).json({ error: error.message }); return; }

      const athleteIds = (relationships || []).map((r) => r.athlete_id);
      let athletes = [];
      let lastLogs = [];
      let upcomingRaces = [];
      let loadInterventions = [];
      let loadActivities = [];

      if (athleteIds.length) {
        const [athleteRes, interventionRes, loadInterventionRes, loadActivityRes, raceRes] = await Promise.all([
          supabase
            .from('athletes')
            .select('id, name, email, primary_sports, target_race_id')
            .in('id', athleteIds),
          supabase
            .from('interventions')
            .select('athlete_id, date, inserted_at')
            .in('athlete_id', athleteIds)
            .order('inserted_at', { ascending: false }),
          supabase
            .from('interventions')
            .select('athlete_id, date, inserted_at, dose_duration, subjective_feel')
            .in('athlete_id', athleteIds)
            .gte('inserted_at', new Date(Date.now() - 42 * 86400000).toISOString()),
          supabase
            .from('activities')
            .select('athlete_id, start_date, moving_time, perceived_exertion')
            .in('athlete_id', athleteIds)
            .gte('start_date', new Date(Date.now() - 42 * 86400000).toISOString()),
          supabase
            .from('races')
            .select('id, athlete_id, name, event_date, race_type, distance_miles')
            .in('athlete_id', athleteIds)
            .gte('event_date', new Date().toISOString().slice(0, 10))
            .order('event_date', { ascending: true }),
        ]);

        athletes = athleteRes.data || [];
        lastLogs = interventionRes.data || [];
        loadInterventions = loadInterventionRes.data || [];
        loadActivities = loadActivityRes.data || [];
        upcomingRaces = raceRes.data || [];
      }

      const enriched = (relationships || []).map((rel) => {
        const athlete = athletes.find((a) => a.id === rel.athlete_id) || null;
        const lastLog = lastLogs.find((l) => l.athlete_id === rel.athlete_id) || null;
        const nextRace = upcomingRaces.find((r) => r.athlete_id === rel.athlete_id) || null;
        const loadMetrics = buildLoadMetrics({
          interventions: loadInterventions.filter((item) => item.athlete_id === rel.athlete_id),
          activities: loadActivities.filter((item) => item.athlete_id === rel.athlete_id),
          lookbackDays: 42,
        });
        const loadStatus = buildLoadStatus(loadMetrics);

        const lastLogDate = lastLog?.date || lastLog?.inserted_at?.slice(0, 10) || null;
        const daysSinceLog = lastLogDate
          ? Math.floor((Date.now() - new Date(lastLogDate).getTime()) / 86400000)
          : null;

        let alertLevel = 'green';
        if (daysSinceLog === null || daysSinceLog >= 7) alertLevel = 'red';
        else if (daysSinceLog >= 4) alertLevel = 'yellow';

        return { ...rel, athlete, lastLogDate, daysSinceLog, nextRace, alertLevel, loadMetrics, loadStatus };
      });

      res.status(200).json({ relationships: enriched, profile });
      return;
    }

    // ── POST: create relationship ───────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.athlete_id) {
        res.status(400).json({ error: 'athlete_id is required' });
        return;
      }

      const { data, error } = await supabase
        .from('coach_athlete_relationships')
        .insert({
          coach_id: profile.id,
          athlete_id: body.athlete_id,
          status: body.status || 'active',
          group_name: body.group_name || null,
          notes: body.notes || null,
          accepted_at: body.status === 'active' ? new Date().toISOString() : null,
        })
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ relationship: data, profile });
      return;
    }

    // ── PATCH: update relationship (status, group_name, notes) ──────────────
    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (!body.id) { res.status(400).json({ error: 'id is required' }); return; }

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

      const { data, error } = await supabase
        .from('coach_athlete_relationships')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ relationship: data });
      return;
    }

    // ── DELETE: remove athlete from roster ──────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) { res.status(400).json({ error: 'id is required' }); return; }

      const { error } = await supabase
        .from('coach_athlete_relationships')
        .update({ status: 'removed', removed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('coach_id', profile.id);

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
