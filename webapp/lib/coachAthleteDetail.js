import { buildProtocolSummary } from './interventionCatalog';
import { getAthleteIdFromRequest, getSupabaseAdminClient } from './authServer';
import { ensureCoachProfile } from './coachServer';
import { attachInterventionMessages, attachProtocolMessages } from './messageServer';
import {
  calculateProtocolComplianceFromEntries,
  countMatchingProtocolEntries,
  getCurrentWeekBlock,
} from './protocolAssignmentEngine';
import { getRaceTypeLabel } from './raceTypes';

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateOnly(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return String(value);
  }
  const parsed = safeDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function differenceInDays(targetDate, baseDate = new Date()) {
  const target = safeDate(targetDate);
  if (!target) return null;
  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

function getWeekKey(value) {
  const parsed = safeDate(value);
  if (!parsed) return null;

  const normalized = new Date(parsed);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + mondayOffset);
  return normalized.toISOString().slice(0, 10);
}

function normalizeInstructions(instructions) {
  if (!instructions) return [];
  if (Array.isArray(instructions)) {
    return instructions.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof instructions === 'string') {
    return instructions
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof instructions === 'object') {
    return Object.entries(instructions)
      .map(([key, value]) => {
        if (value === null || value === undefined || value === '') return '';
        if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
        return `${key}: ${value}`;
      })
      .filter(Boolean);
  }
  return [];
}

function getResponseScore(entry) {
  return Math.max(entry.gi_response || 0, entry.physical_response || 0, entry.subjective_feel || 0);
}

function getRaceMilestones(raceDate) {
  const daysUntilRace = differenceInDays(raceDate);
  const milestones = [
    { id: '8-weeks', label: '8 weeks out', daysOut: 56 },
    { id: '4-weeks', label: '4 weeks out', daysOut: 28 },
    { id: 'race-week', label: 'Race week', daysOut: 7 },
  ];

  return milestones.map((milestone) => {
    const targetDate = safeDate(raceDate);
    if (!targetDate) {
      return { ...milestone, dateLabel: 'No date', state: 'upcoming' };
    }

    const milestoneDate = new Date(targetDate);
    milestoneDate.setDate(milestoneDate.getDate() - milestone.daysOut);

    let state = 'upcoming';
    if (daysUntilRace !== null && daysUntilRace <= milestone.daysOut) {
      state = daysUntilRace > Math.max(0, milestone.daysOut - 7) ? 'current' : 'complete';
    }

    return {
      ...milestone,
      dateLabel: milestoneDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      state,
    };
  });
}

export async function getCoachAthleteDetailData({ req, athleteId: athleteIdParam }) {
  const admin = getSupabaseAdminClient();
  const coachAthleteId = getAthleteIdFromRequest(req);

  if (!coachAthleteId) {
    return { authenticated: false };
  }

  const { data: coachAthlete, error: coachAthleteError } = await admin
    .from('athletes')
    .select('id, name, email, supabase_user_id')
    .eq('id', coachAthleteId)
    .maybeSingle();

  if (coachAthleteError) throw coachAthleteError;
  if (!coachAthlete) return { authenticated: false };

  const profile = await ensureCoachProfile(admin, coachAthlete);
  const athleteId = athleteIdParam;

  const { data: relationship, error: relationshipError } = await admin
    .from('coach_athlete_relationships')
    .select('id, coach_id, athlete_id, status, group_name, notes, invited_at, accepted_at, created_at')
    .eq('coach_id', profile.id)
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (relationshipError) throw relationshipError;
  if (!relationship) {
    return { authenticated: true, authorized: false };
  }

  const [
    { data: athlete, error: athleteError },
    { data: interventions, error: interventionsError },
    { data: protocols, error: protocolsError },
    { data: notes, error: notesError },
    { data: races, error: racesError },
  ] = await Promise.all([
    admin
      .from('athletes')
      .select('id, name, email, primary_sports, target_race_id, created_at')
      .eq('id', athleteId)
      .maybeSingle(),
    admin
      .from('interventions')
      .select(
        'id, athlete_id, date, inserted_at, intervention_type, details, dose_duration, timing, protocol_payload, assigned_protocol_id, gi_response, physical_response, subjective_feel, activity_id, training_phase, target_race, target_race_date, race_id, notes, races(id, name, event_date, race_type, distance_miles, location)'
      )
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false })
      .order('inserted_at', { ascending: false }),
    admin
      .from('assigned_protocols')
      .select(
        'id, athlete_id, coach_id, protocol_name, protocol_type, description, instructions, target_race_id, start_date, end_date, status, compliance_target, created_at, updated_at, races(id, name, event_date, race_type, distance_miles, location)'
      )
      .eq('coach_id', profile.id)
      .eq('athlete_id', athleteId)
      .order('start_date', { ascending: false }),
    admin
      .from('coach_notes')
      .select('id, athlete_id, content, note_type, related_intervention_id, related_protocol_id, is_pinned, created_at')
      .eq('coach_id', profile.id)
      .eq('athlete_id', athleteId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    admin
      .from('races')
      .select('id, athlete_id, name, event_date, race_type, distance_miles, elevation_gain_ft, location, surface, notes')
      .eq('athlete_id', athleteId)
      .order('event_date', { ascending: true, nullsFirst: false }),
  ]);

  if (athleteError) throw athleteError;
  if (interventionsError) throw interventionsError;
  if (protocolsError) throw protocolsError;
  if (notesError) throw notesError;
  if (racesError) throw racesError;

  const athleteInterventions = interventions || [];
  const athleteProtocols = (protocols || []).map((protocol) => {
    const matchingInterventions = athleteInterventions.filter((entry) => (
      entry.assigned_protocol_id
        ? entry.assigned_protocol_id === protocol.id
        : countMatchingProtocolEntries(protocol, [entry]) === 1
    ));
    const compliance = calculateProtocolComplianceFromEntries(protocol, athleteInterventions);
    const currentWeekBlock = getCurrentWeekBlock(protocol);

    return {
      ...protocol,
      compliance: compliance.compliance_percent,
      expected_entries: compliance.expected_entries,
      actual_entries: compliance.actual_entries,
      instructions_list: normalizeInstructions(protocol.instructions),
      current_week_block: currentWeekBlock,
      matching_interventions: matchingInterventions,
      timeline: matchingInterventions
        .map((entry) => ({
          id: entry.id,
          date: entry.date || toDateOnly(entry.inserted_at),
          summary: buildProtocolSummary(entry.intervention_type, entry.protocol_payload),
        }))
        .sort((left, right) => String(left.date || '').localeCompare(String(right.date || ''))),
    };
  });

  const athleteRaces = (races || []).map((race) => ({
    ...race,
    race_type_label: getRaceTypeLabel(race),
    days_until: differenceInDays(race.event_date),
  }));

  const upcomingRace =
    athleteRaces.find((race) => race.id === athlete?.target_race_id && race.days_until !== null && race.days_until >= 0) ||
    athleteRaces.find((race) => race.days_until !== null && race.days_until >= 0) ||
    null;

  const protocolChecklist = athleteProtocols
    .filter((protocol) => ['assigned', 'in_progress', 'completed'].includes(protocol.status))
    .map((protocol) => ({
      id: protocol.id,
      label: protocol.protocol_name,
      status: protocol.status,
      compliance: protocol.compliance,
      target: protocol.compliance_target,
      complete: protocol.status === 'completed' || protocol.compliance >= protocol.compliance_target,
      dueDate: protocol.end_date,
      raceName: protocol.races?.name || null,
    }));

  const coachActor = {
    id: coachAthlete.id,
    name: coachAthlete.name,
    email: coachAthlete.email,
    supabase_user_id: coachAthlete.supabase_user_id,
  };
  const interventionsWithMessages = await attachInterventionMessages(
    admin,
    coachActor,
    athleteInterventions.map((entry) => ({
      ...entry,
      summary: buildProtocolSummary(entry.intervention_type, entry.protocol_payload),
      response_score: getResponseScore(entry),
    }))
  );
  const protocolsWithMessages = await attachProtocolMessages(admin, coachActor, athleteProtocols);

  return {
    authenticated: true,
    authorized: true,
    profile,
    relationship,
    athlete: {
      ...athlete,
      sport_label: Array.isArray(athlete?.primary_sports) && athlete.primary_sports.length
        ? athlete.primary_sports.join(' / ')
        : 'Sport not set',
    },
    interventions: interventionsWithMessages,
    protocols: protocolsWithMessages,
    notes: notes || [],
    races: athleteRaces,
    overview: {
      active_since: relationship.accepted_at || relationship.created_at || athlete?.created_at || null,
      total_interventions: interventionsWithMessages.length,
      total_notes: (notes || []).length,
      recent_interventions: interventionsWithMessages.slice(0, 10),
      active_protocols: protocolsWithMessages.filter((protocol) => ['assigned', 'in_progress'].includes(protocol.status)),
      upcoming_race: upcomingRace,
      race_milestones: upcomingRace ? getRaceMilestones(upcomingRace.event_date) : [],
      protocol_checklist: protocolChecklist,
      race_architecture_available: false,
    },
  };
}
