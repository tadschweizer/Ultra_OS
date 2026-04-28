import { inferLegacyScores, normalizeProtocolPayload } from './interventionCatalog';
import { selectBestMatchingProtocol, toDateOnly } from './protocolAssignmentEngine';

function parseOptionalInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function findAssignedProtocolForIntervention({
  admin,
  athleteId,
  interventionType,
  interventionDate,
  raceId,
}) {
  if (!athleteId || !interventionType || !interventionDate) return null;

  const dateOnly = toDateOnly(interventionDate);
  if (!dateOnly) return null;

  const { data, error } = await admin
    .from('assigned_protocols')
    .select('id, athlete_id, protocol_name, protocol_type, target_race_id, start_date, end_date, status')
    .eq('athlete_id', athleteId)
    .eq('protocol_type', interventionType)
    .in('status', ['assigned', 'in_progress']);

  if (error) {
    throw error;
  }

  return selectBestMatchingProtocol(data || [], {
    interventionType,
    interventionDate: dateOnly,
    raceId: raceId || null,
  });
}

export async function buildInterventionInsertPayload({ admin, athleteId, body }) {
  const protocolPayload = normalizeProtocolPayload(body.intervention_type, body.protocol_payload || {});
  const legacyFields = inferLegacyScores(body.intervention_type, protocolPayload);
  const assignedProtocol = await findAssignedProtocolForIntervention({
    admin,
    athleteId,
    interventionType: body.intervention_type,
    interventionDate: body.date,
    raceId: body.race_id,
  });

  if (assignedProtocol?.id && assignedProtocol.status === 'assigned') {
    await admin
      .from('assigned_protocols')
      .update({ status: 'in_progress' })
      .eq('id', assignedProtocol.id);
  }

  return {
    athlete_id: athleteId,
    race_id: body.race_id || null,
    activity_id: body.activity_id || null,
    activity_provider: body.activity_provider || null,
    date: body.date || null,
    intervention_type: body.intervention_type || null,
    details: body.details || legacyFields.details,
    dose_duration: body.dose_duration || legacyFields.dose_duration,
    timing: body.timing || legacyFields.timing,
    protocol_payload: protocolPayload,
    assigned_protocol_id: assignedProtocol?.id || body.assigned_protocol_id || null,
    gi_response: parseOptionalInt(body.gi_response) ?? legacyFields.gi_response,
    physical_response: parseOptionalInt(body.physical_response) ?? legacyFields.physical_response,
    subjective_feel: parseOptionalInt(body.subjective_feel) ?? legacyFields.subjective_feel,
    training_phase: body.training_phase || null,
    target_race: body.target_race || null,
    target_race_date: body.target_race_date || null,
    notes: body.notes || null,
  };
}
