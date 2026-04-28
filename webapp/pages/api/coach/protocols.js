import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../../lib/authServer';
import { ensureCoachProfile } from '../../../lib/coachServer';
import {
  buildInstructionsPayload,
  calculateDurationWeeks,
  getCurrentProtocolWeek,
  getCurrentWeekBlock,
  normalizeWeeklyBlocks,
  protocolStatusOptions,
  toDateOnly,
} from '../../../lib/protocolAssignmentEngine';

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sanitizeProtocolPayload(body = {}) {
  const startDate = toDateOnly(body.start_date);
  const durationWeeks = Math.max(1, Number(body.duration_weeks || calculateDurationWeeks(body.start_date, body.end_date) || 1));
  const endDate = toDateOnly(body.end_date) || (startDate ? addDays(startDate, durationWeeks * 7 - 1) : null);
  const weeklyBlocks = normalizeWeeklyBlocks(body.instructions?.weekly_blocks, durationWeeks);

  return {
    protocol_name: String(body.protocol_name || '').trim(),
    protocol_type: String(body.protocol_type || '').trim(),
    description: String(body.description || '').trim() || null,
    instructions: buildInstructionsPayload(weeklyBlocks),
    target_race_id: body.target_race_id || null,
    start_date: startDate,
    end_date: endDate,
    status: protocolStatusOptions.includes(body.status) ? body.status : 'assigned',
    compliance_target: Math.min(100, Math.max(0, Number(body.compliance_target ?? 80))),
  };
}

async function decorateProtocols(admin, protocols = []) {
  const protocolIds = protocols.map((protocol) => protocol.id);
  const athleteIds = [...new Set(protocols.map((protocol) => protocol.athlete_id))];

  const [athleteResult, interventionResult, complianceResults] = await Promise.all([
    athleteIds.length
      ? admin.from('athletes').select('id, name').in('id', athleteIds)
      : { data: [], error: null },
    athleteIds.length
      ? admin
          .from('interventions')
          .select('id, athlete_id, date, inserted_at, intervention_type, assigned_protocol_id, race_id, races(id, name)')
          .in('athlete_id', athleteIds)
      : { data: [], error: null },
    Promise.all(
      protocolIds.map(async (protocolId) => {
        const { data, error } = await admin.rpc('calculate_protocol_compliance', { protocol_uuid: protocolId });
        if (error) throw error;
        const result = Array.isArray(data) ? data[0] : data;
        return [protocolId, result || null];
      })
    ),
  ]);

  if (athleteResult.error) throw athleteResult.error;
  if (interventionResult.error) throw interventionResult.error;

  const athleteNameById = new Map((athleteResult.data || []).map((item) => [item.id, item.name]));
  const interventionsByAthlete = (interventionResult.data || []).reduce((accumulator, item) => {
    accumulator[item.athlete_id] = accumulator[item.athlete_id] || [];
    accumulator[item.athlete_id].push(item);
    return accumulator;
  }, {});
  const complianceById = new Map(complianceResults);

  return protocols.map((protocol) => {
    const compliance = complianceById.get(protocol.id) || {
      expected_entries: 0,
      actual_entries: 0,
      compliance_percent: 0,
      weeks_elapsed: 0,
    };
    const athleteInterventions = interventionsByAthlete[protocol.athlete_id] || [];

    return {
      ...protocol,
      athlete: {
        id: protocol.athlete_id,
        name: athleteNameById.get(protocol.athlete_id) || 'Athlete',
      },
      current_week: getCurrentProtocolWeek(protocol),
      current_week_block: getCurrentWeekBlock(protocol),
      expected_entries: compliance.expected_entries || 0,
      actual_entries: compliance.actual_entries || 0,
      compliance: compliance.compliance_percent || 0,
      matching_interventions: athleteInterventions.filter((item) =>
        item.assigned_protocol_id
          ? item.assigned_protocol_id === protocol.id
          : item.intervention_type === protocol.protocol_type
      ),
    };
  });
}

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    const { data: athlete, error: athleteError } = await admin
      .from('athletes')
      .select('id, name, email')
      .eq('id', athleteId)
      .maybeSingle();

    if (athleteError) throw athleteError;
    if (!athlete) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const profile = await ensureCoachProfile(admin, athlete);

    if (req.method === 'GET') {
      let query = admin
        .from('assigned_protocols')
        .select('id, coach_id, athlete_id, protocol_name, protocol_type, description, instructions, target_race_id, start_date, end_date, status, compliance_target, created_at, updated_at, races(id, name, event_date, race_type, distance_miles, location)')
        .eq('coach_id', profile.id)
        .order('start_date', { ascending: false });

      if (typeof req.query.athlete_id === 'string') {
        query = query.eq('athlete_id', req.query.athlete_id);
      }
      if (typeof req.query.status === 'string') {
        query = query.eq('status', req.query.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      const protocols = await decorateProtocols(admin, data || []);
      res.status(200).json({ protocols, profile });
      return;
    }

    if (req.method === 'POST') {
      const payload = sanitizeProtocolPayload(req.body || {});
      const athleteTargetId = req.body?.athlete_id;

      if (!athleteTargetId) {
        res.status(400).json({ error: 'Athlete id is required.' });
        return;
      }
      if (!payload.protocol_name || !payload.protocol_type || !payload.start_date || !payload.end_date) {
        res.status(400).json({ error: 'Protocol name, type, start date, and end date are required.' });
        return;
      }

      const { data, error } = await admin
        .from('assigned_protocols')
        .insert({
          coach_id: profile.id,
          athlete_id: athleteTargetId,
          ...payload,
        })
        .select('id, coach_id, athlete_id, protocol_name, protocol_type, description, instructions, target_race_id, start_date, end_date, status, compliance_target, created_at, updated_at, races(id, name, event_date, race_type, distance_miles, location)')
        .single();

      if (error) throw error;
      const [protocol] = await decorateProtocols(admin, [data]);
      res.status(200).json({ protocol, profile });
      return;
    }

    if (req.method === 'PUT') {
      const protocolId = req.body?.id;
      if (!protocolId) {
        res.status(400).json({ error: 'Protocol id is required.' });
        return;
      }

      const payload = sanitizeProtocolPayload(req.body || {});

      const { data, error } = await admin
        .from('assigned_protocols')
        .update(payload)
        .eq('id', protocolId)
        .eq('coach_id', profile.id)
        .select('id, coach_id, athlete_id, protocol_name, protocol_type, description, instructions, target_race_id, start_date, end_date, status, compliance_target, created_at, updated_at, races(id, name, event_date, race_type, distance_miles, location)')
        .single();

      if (error) throw error;
      const [protocol] = await decorateProtocols(admin, [data]);
      res.status(200).json({ protocol });
      return;
    }

    if (req.method === 'DELETE') {
      const protocolId = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
      if (!protocolId) {
        res.status(400).json({ error: 'Protocol id is required.' });
        return;
      }

      const { error } = await admin
        .from('assigned_protocols')
        .update({ status: 'abandoned' })
        .eq('id', protocolId)
        .eq('coach_id', profile.id);

      if (error) throw error;
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error('[coach/protocols] failed:', error);
    res.status(500).json({ error: error.message || 'Could not load protocols.' });
  }
}
