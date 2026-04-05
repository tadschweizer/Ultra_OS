import cookie from 'cookie';
import { supabase } from '../../lib/supabaseClient';
import {
  computePhaseFromDays,
  countAssignmentCompletions,
  generateCoachCode,
  getDaysUntil,
  normalizeRace,
} from '../../lib/coachProtocols';

export const runtime = 'edge';

function getAthleteId(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return cookies.athlete_id;
}

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();

  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code, created_at')
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
    .select('id, athlete_id, display_name, coach_code, created_at')
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const profile = await ensureCoachProfile(athleteId);

    if (req.method === 'GET') {
      const { data: links, error } = await supabase
        .from('coach_athlete_links')
        .select('id, athlete_id, role, status, created_at')
        .eq('coach_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const athleteIds = (links || []).map((item) => item.athlete_id);
      let athletes = [];
      if (athleteIds.length) {
        const { data: rosterAthletes, error: athleteError } = await supabase
          .from('athletes')
          .select('id, name')
          .in('id', athleteIds);

        if (athleteError) {
          res.status(500).json({ error: athleteError.message });
          return;
        }

        athletes = rosterAthletes || [];
      }

      const { data: races } = athleteIds.length
        ? await supabase
            .from('races')
            .select('id, athlete_id, name, event_date, race_type, distance_miles, surface')
            .in('athlete_id', athleteIds)
        : { data: [] };

      const { data: interventions } = athleteIds.length
        ? await supabase
            .from('interventions')
            .select('id, athlete_id, date, inserted_at, training_phase, intervention_type, race_id, target_race, races(id, name)')
            .in('athlete_id', athleteIds)
            .order('date', { ascending: false })
        : { data: [] };

      const { data: assignments } = athleteIds.length
        ? await supabase
            .from('coach_protocol_assignments')
            .select('id, athlete_id, target_race_id, intervention_type, start_date, target_completion_date, planned_sessions, status')
            .eq('coach_id', profile.id)
            .in('athlete_id', athleteIds)
            .eq('status', 'active')
        : { data: [] };

      const roster = (links || []).map((link) => {
        const athlete = athletes.find((item) => item.id === link.athlete_id) || null;
        const athleteRaces = (races || [])
          .filter((race) => race.athlete_id === link.athlete_id)
          .map(normalizeRace)
          .sort((a, b) => new Date(a.event_date || 0).getTime() - new Date(b.event_date || 0).getTime());
        const nextRace = athleteRaces.find((race) => getDaysUntil(race.event_date) >= 0) || athleteRaces[0] || null;
        const athleteInterventions = (interventions || []).filter((item) => item.athlete_id === link.athlete_id);
        const athleteAssignments = (assignments || []).filter((item) => item.athlete_id === link.athlete_id);
        const activeAssignment = athleteAssignments[0] || null;
        const completionCount = activeAssignment ? countAssignmentCompletions(activeAssignment, athleteInterventions) : 0;
        const daysUntilRace = getDaysUntil(nextRace?.event_date);
        const latestPhase = athleteInterventions.find((item) => item.training_phase)?.training_phase || '';
        const phase = latestPhase || computePhaseFromDays(daysUntilRace);
        const lastLogDate = athleteInterventions[0]?.date || athleteInterventions[0]?.inserted_at?.slice(0, 10) || null;

        let status = 'Green';
        let reason = 'On track';
        if (lastLogDate) {
          const lastLogDays = getDaysUntil(lastLogDate) * -1;
          if (lastLogDays >= 5) {
            status = 'Red';
            reason = 'No recent logging for 5+ days';
          } else if (lastLogDays >= 3) {
            status = 'Yellow';
            reason = 'No log in the last 3 to 5 days';
          }
        }

        if (activeAssignment && activeAssignment.planned_sessions > 0) {
          const completionRatio = completionCount / activeAssignment.planned_sessions;
          if (daysUntilRace !== null && daysUntilRace < 28 && completionRatio < 0.7) {
            status = 'Red';
            reason = 'Protocol behind with race inside 4 weeks';
          } else if (completionRatio < 0.7 && status !== 'Red') {
            status = 'Yellow';
            reason = 'Protocol behind but recoverable';
          }
        }

        return {
          ...link,
          athlete,
          nextRace,
          daysUntilRace,
          phase,
          lastLogDate,
          status,
          reason,
          activeAssignment: activeAssignment
            ? {
                ...activeAssignment,
                completion_count: completionCount,
              }
            : null,
        };
      });

      res.status(200).json({ profile, roster });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const athleteTargetId = body.athlete_id;
      const role = body.role === 'secondary' ? 'secondary' : 'primary';

      if (!athleteTargetId) {
        res.status(400).json({ error: 'athlete_id is required' });
        return;
      }

      const { data, error } = await supabase
        .from('coach_athlete_links')
        .insert({
          athlete_id: athleteTargetId,
          coach_id: profile.id,
          role,
          status: 'active',
        })
        .select('id, athlete_id, role, status, created_at')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ link: data, profile });
      return;
    }

    if (req.method === 'DELETE') {
      const athleteTargetId = typeof req.query.athlete_id === 'string' ? req.query.athlete_id : req.body?.athlete_id;

      if (!athleteTargetId) {
        res.status(400).json({ error: 'athlete_id is required' });
        return;
      }

      const { error } = await supabase
        .from('coach_athlete_links')
        .update({ status: 'inactive' })
        .eq('coach_id', profile.id)
        .eq('athlete_id', athleteTargetId)
        .eq('status', 'active');

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
