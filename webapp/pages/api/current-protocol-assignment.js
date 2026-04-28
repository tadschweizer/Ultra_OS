import {
  getAthleteIdFromRequest,
  getSupabaseAdminClient,
} from '../../lib/authServer';
import { attachProtocolMessages } from '../../lib/messageServer';
import {
  calculateProtocolComplianceFromEntries,
  getCurrentProtocolWeek,
  getCurrentWeekBlock,
} from '../../lib/protocolAssignmentEngine';

function normalizeRace(race = {}) {
  if (!race) return null;
  return {
    ...race,
    race_type: race.race_type || 'Not set',
  };
}

function getDaysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function computePhaseFromDays(daysUntil) {
  if (daysUntil === null || daysUntil === undefined) return 'Base';
  if (daysUntil > 84) return 'Base';
  if (daysUntil >= 56) return 'Build';
  if (daysUntil >= 21) return 'Peak';
  if (daysUntil >= 7) return 'Taper';
  return 'Race Week';
}

function pickCurrentRace(races = [], activeProtocols = []) {
  const raceIds = activeProtocols.map((protocol) => protocol.target_race_id).filter(Boolean);
  const protocolRace = races.find((race) => raceIds.includes(race.id));
  if (protocolRace) return protocolRace;

  return (
    races
      .filter((race) => race.event_date)
      .sort((left, right) => new Date(left.event_date).getTime() - new Date(right.event_date).getTime())
      .find((race) => getDaysUntil(race.event_date) >= 0) ||
    races[0] ||
    null
  );
}

function buildProtocolStatus(activeProtocols = []) {
  if (!activeProtocols.length) {
    return 'No active protocols — log your first intervention';
  }

  const lead = activeProtocols[0];
  return `${lead.protocol_name}: ${lead.actual_entries}/${lead.expected_entries || 0} expected entries logged`;
}

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    const [{ data: athlete, error: athleteError }, { data: races, error: raceError }, { data: protocols, error: protocolError }, { data: interventions, error: interventionError }] = await Promise.all([
      admin
        .from('athletes')
        .select('id, name, email, supabase_user_id')
        .eq('id', athleteId)
        .maybeSingle(),
      admin
        .from('races')
        .select('id, name, event_date, race_type, distance_miles, elevation_gain_ft, location, surface, notes')
        .eq('athlete_id', athleteId)
        .order('event_date', { ascending: true, nullsFirst: false }),
      admin
        .from('assigned_protocols')
        .select('id, athlete_id, coach_id, protocol_name, protocol_type, description, instructions, target_race_id, start_date, end_date, status, compliance_target, created_at, updated_at, races(id, name, event_date, race_type), coach_profiles(display_name)')
        .eq('athlete_id', athleteId)
        .in('status', ['assigned', 'in_progress'])
        .order('start_date', { ascending: true }),
      admin
        .from('interventions')
        .select('id, athlete_id, date, inserted_at, intervention_type, assigned_protocol_id, training_phase, race_id, races(id, name)')
        .eq('athlete_id', athleteId)
        .order('date', { ascending: false })
        .order('inserted_at', { ascending: false }),
    ]);

    if (athleteError) throw athleteError;
    if (raceError) throw raceError;
    if (protocolError) throw protocolError;
    if (interventionError) throw interventionError;

    const activeAssignments = (protocols || []).map((protocol) => {
      const compliance = calculateProtocolComplianceFromEntries(protocol, interventions || []);
      const currentWeekBlock = getCurrentWeekBlock(protocol);

      return {
        ...protocol,
        coach_name: protocol.coach_profiles?.display_name || 'Coach',
        current_week: getCurrentProtocolWeek(protocol),
        current_week_block: currentWeekBlock,
        current_week_summary: currentWeekBlock
          ? [
              currentWeekBlock.instruction_text,
              currentWeekBlock.frequency_per_week ? `${currentWeekBlock.frequency_per_week}x/week` : '',
              currentWeekBlock.target_metric,
            ]
              .filter(Boolean)
              .join(' • ')
          : '',
        expected_entries: compliance.expected_entries,
        actual_entries: compliance.actual_entries,
        compliance: compliance.compliance_percent,
      };
    });

    const activeAssignmentsWithMessages = await attachProtocolMessages(admin, athlete, activeAssignments);
    const currentRace = pickCurrentRace((races || []).map(normalizeRace), activeAssignmentsWithMessages);
    const relevantInterventions = currentRace
      ? (interventions || []).filter((item) => item.race_id === currentRace.id || item.races?.id === currentRace.id)
      : interventions || [];
    const phase = relevantInterventions.find((item) => item.training_phase)?.training_phase || computePhaseFromDays(getDaysUntil(currentRace?.event_date));

    res.status(200).json({
      currentRace,
      activeAssignments: activeAssignmentsWithMessages,
      activeAssignment: activeAssignmentsWithMessages[0] || null,
      phase,
      daysUntilRace: getDaysUntil(currentRace?.event_date),
      protocolStatus: buildProtocolStatus(activeAssignmentsWithMessages),
    });
  } catch (error) {
    console.error('[current-protocol-assignment] failed:', error);
    res.status(500).json({ error: error.message || 'Could not load current protocol summary.' });
  }
}
