import { getSupabaseAdminClient } from '../../lib/authServer';
import {
  computePlannedSessions,
  countAssignmentCompletions,
  evaluateProtocolRules,
} from '../../lib/coachProtocols';
import {
  requireActiveCoachRelationship,
  requireCoachAccess,
} from '../../lib/auth/roleAccessServer.js';

// Coach tables are no longer reachable with the public anon key (RLS is on and
// the anon grants are revoked), so this route uses the service-role client.
// Authorisation is enforced in the handler from the session athlete id.
const supabase = getSupabaseAdminClient();

function normalizePayload(body = {}, coachId) {
  const plannedSessions = computePlannedSessions({
    startDate: body.start_date,
    endDate: body.target_completion_date,
    frequencyType: body.frequency_type,
    plannedSessions: body.planned_sessions,
  });
  const rulesResult = evaluateProtocolRules({
    interventionType: body.intervention_type,
    frequencyType: body.frequency_type || 'weekly',
    plannedSessions,
    responseMetrics: body.response_metrics || {},
    currentLoad: body.current_load || {},
    coachOverrideReason: body.coach_override_reason || null,
  });

  return {
    athlete_id: body.athlete_id,
    coach_id: coachId,
    target_race_id: body.target_race_id || null,
    intervention_type: body.intervention_type,
    start_date: body.start_date,
    target_completion_date: body.target_completion_date,
    frequency_type: rulesResult.recommendation.frequency_type || body.frequency_type || 'weekly',
    frequency_details: {
      ...(body.frequency_details || {}),
      rules_engine: rulesResult,
      why_this_next_step: rulesResult.recommendationText,
      confidence: rulesResult.confidence,
    },
    planned_sessions: rulesResult.recommendation.planned_sessions ?? plannedSessions,
    note: body.note?.trim() || null,
    status: body.status || 'active',
    coach_override_reason: rulesResult.override.reason,
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  const access = await requireCoachAccess(req, res, supabase);
  if (!access) return;

  try {
    const profile = access.profile;

    if (req.method === 'GET') {
      const athleteFilter = typeof req.query.athlete_id === 'string' ? req.query.athlete_id : null;
      let query = supabase
        .from('coach_protocol_assignments')
        .select('id, athlete_id, coach_id, target_race_id, intervention_type, start_date, target_completion_date, frequency_type, frequency_details, planned_sessions, note, status, created_at, updated_at, races(id, name, event_date, race_type, distance_miles, surface)')
        .eq('coach_id', profile.id)
        .order('target_completion_date', { ascending: true });

      if (athleteFilter) {
        const relationship = await requireActiveCoachRelationship(
          res,
          supabase,
          profile.id,
          athleteFilter
        );
        if (!relationship) return;
        query = query.eq('athlete_id', athleteFilter);
      } else {
        const { data: activeRelationships, error: relationshipError } = await supabase
          .from('coach_athlete_relationships')
          .select('athlete_id')
          .eq('coach_id', profile.id)
          .eq('status', 'active');
        if (relationshipError) throw relationshipError;
        const activeIds = (activeRelationships || []).map((item) => item.athlete_id);
        if (!activeIds.length) {
          res.status(200).json({ assignments: [], profile });
          return;
        }
        query = query.in('athlete_id', activeIds);
      }

      const { data, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const athleteIds = [...new Set((data || []).map((item) => item.athlete_id))];
      const { data: athletes } = athleteIds.length
        ? await supabase.from('athletes').select('id, name').in('id', athleteIds)
        : { data: [] };

      const { data: interventions } = athleteIds.length
        ? await supabase
            .from('interventions')
            .select('id, athlete_id, date, inserted_at, intervention_type, race_id, races(id, name)')
            .in('athlete_id', athleteIds)
        : { data: [] };

      const assignments = (data || []).map((assignment) => ({
        ...assignment,
        athlete: (athletes || []).find((item) => item.id === assignment.athlete_id) || null,
        completion_count: countAssignmentCompletions(
          assignment,
          (interventions || []).filter((item) => item.athlete_id === assignment.athlete_id)
        ),
      }));

      res.status(200).json({ assignments, profile });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.athlete_id || !body.intervention_type || !body.start_date || !body.target_completion_date) {
        res.status(400).json({ error: 'athlete_id, intervention_type, start_date, and target_completion_date are required' });
        return;
      }
      const relationship = await requireActiveCoachRelationship(
        res,
        supabase,
        profile.id,
        body.athlete_id
      );
      if (!relationship) return;

      const payload = normalizePayload(body, profile.id);
      const { data, error } = await supabase
        .from('coach_protocol_assignments')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ assignment: data, profile });
      return;
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) {
        res.status(400).json({ error: 'id is required' });
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from('coach_protocol_assignments')
        .select('id, athlete_id')
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      const relationship = await requireActiveCoachRelationship(
        res,
        supabase,
        profile.id,
        existing.athlete_id
      );
      if (!relationship) return;

      const payload = normalizePayload({ ...body, athlete_id: existing.athlete_id }, profile.id);
      const { data, error } = await supabase
        .from('coach_protocol_assignments')
        .update(payload)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ assignment: data, profile });
      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
