import { getAthleteIdFromRequest, getSupabaseAdminClient } from './authServer';
import { ensureCoachProfile } from './coachServer';
import { getCoachGroupColorStyle, sanitizeCoachGroupColor } from './coachGroups';
import { getInterventionDefinition } from './interventionCatalog';
import { calculateProtocolComplianceFromEntries } from './protocolAssignmentEngine';

const READINESS_WEIGHTS = {
  protocolCompliance: 0.3,
  interventionConsistency: 0.2,
  trainingLoad: 0.2,
  sleepQuality: 0.15,
  gutTraining: 0.15,
};

const GUT_TARGETS = {
  Marathon: 80,
  '50K+': 70,
  Triathlon: 70,
  Gravel: 60,
  'Half Marathon': 45,
  '10K': 20,
  '3K / 5K': 0,
  '1 Mile / 1500m': 0,
  Other: 60,
};

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value = new Date()) {
  const date = safeDate(value) || new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateOnly(value) {
  const parsed = safeDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function differenceInDays(targetDate, baseDate = new Date()) {
  const target = safeDate(targetDate);
  if (!target) return null;
  const normalizedTarget = startOfDay(target);
  const normalizedBase = startOfDay(baseDate);
  return Math.round((normalizedTarget.getTime() - normalizedBase.getTime()) / 86400000);
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}

function average(values = []) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + Number(value || 0), 0) / values.length;
}

function createEmptyWindowedValues(items, getDate, getValue, days) {
  const today = startOfDay();
  return items
    .filter((item) => {
      const date = safeDate(getDate(item));
      if (!date) return false;
      const diff = differenceInDays(today, date);
      return diff !== null && diff >= 0 && diff < days;
    })
    .map((item) => Number(getValue(item)))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function categorizeIntervention(interventionType) {
  return getInterventionDefinition(interventionType)?.phase || 'Other';
}

function getGroupRecordByName(groups, groupName) {
  return groups.find((group) => group.name === groupName) || null;
}

function getAthleteInitials(name) {
  return String(name || 'Athlete')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'A';
}

function scoreFromThresholds(value, { green, amber }) {
  if (value >= green) return 'green';
  if (value >= amber) return 'amber';
  return 'red';
}

function raceCarbTarget(raceType) {
  return GUT_TARGETS[raceType] ?? GUT_TARGETS.Other;
}

function getTimelineState(targetDate) {
  const diff = differenceInDays(targetDate);
  if (diff === null) return 'remaining';
  return diff < 0 ? 'completed' : 'remaining';
}

export async function getCoachAnalyticsBase({ req }) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) return { authenticated: false };

  const admin = getSupabaseAdminClient();
  const { data: coachAthlete, error: coachAthleteError } = await admin
    .from('athletes')
    .select('id, name, email, supabase_user_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (coachAthleteError) throw coachAthleteError;
  if (!coachAthlete) return { authenticated: false };

  const profile = await ensureCoachProfile(admin, coachAthlete);

  const { data: relationships, error: relationshipError } = await admin
    .from('coach_athlete_relationships')
    .select('id, athlete_id, status, group_name, notes, invited_at, accepted_at, created_at')
    .eq('coach_id', profile.id)
    .eq('status', 'active')
    .order('accepted_at', { ascending: true, nullsFirst: false });

  if (relationshipError) throw relationshipError;

  const { data: groups, error: groupsError } = await admin
    .from('coach_groups')
    .select('id, coach_id, name, color, sort_order, created_at, updated_at')
    .eq('coach_id', profile.id)
    .order('sort_order', { ascending: true });

  if (groupsError) throw groupsError;

  const athleteIds = (relationships || []).map((relationship) => relationship.athlete_id);
  if (!athleteIds.length) {
    return {
      authenticated: true,
      profile,
      relationships: [],
      athletes: [],
      interventions: [],
      protocols: [],
      races: [],
      settings: [],
      activities: [],
      groups: (groups || []).map((group) => ({
        ...group,
        color: sanitizeCoachGroupColor(group.color),
        color_style: getCoachGroupColorStyle(group.color, 'soft'),
      })),
    };
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [{ data: athletes, error: athletesError }, { data: interventions, error: interventionsError }, { data: protocols, error: protocolsError }, { data: races, error: racesError }, { data: settings, error: settingsError }, { data: activities, error: activitiesError }] = await Promise.all([
    admin
      .from('athletes')
      .select('id, name, email, primary_sports, target_race_id, created_at')
      .in('id', athleteIds),
    admin
      .from('interventions')
      .select('id, athlete_id, date, inserted_at, intervention_type, protocol_payload, assigned_protocol_id, gi_response, physical_response, subjective_feel, activity_id, race_id, races(id, name, event_date, race_type)')
      .in('athlete_id', athleteIds)
      .gte('inserted_at', ninetyDaysAgo.toISOString())
      .order('date', { ascending: false })
      .order('inserted_at', { ascending: false }),
    admin
      .from('assigned_protocols')
      .select('id, athlete_id, coach_id, protocol_name, protocol_type, instructions, target_race_id, start_date, end_date, status, compliance_target, created_at, updated_at')
      .eq('coach_id', profile.id)
      .in('athlete_id', athleteIds)
      .order('start_date', { ascending: false }),
    admin
      .from('races')
      .select('id, athlete_id, name, event_date, race_type, distance_miles, location')
      .in('athlete_id', athleteIds)
      .order('event_date', { ascending: true }),
    admin
      .from('athlete_settings')
      .select('athlete_id, normal_long_run_carb_g_per_hr, typical_sleep_hours, fluid_target_ml_per_hr')
      .in('athlete_id', athleteIds),
    admin
      .from('strava_activities')
      .select('id, athlete_id, start_date, distance, moving_time, total_elevation_gain, average_heartrate, kilojoules, sport_type')
      .in('athlete_id', athleteIds)
      .gte('start_date', ninetyDaysAgo.toISOString())
      .order('start_date', { ascending: false }),
  ]);

  if (athletesError) throw athletesError;
  if (interventionsError) throw interventionsError;
  if (protocolsError) throw protocolsError;
  if (racesError) throw racesError;
  if (settingsError) throw settingsError;
  if (activitiesError) throw activitiesError;

  return {
    authenticated: true,
    profile,
    relationships: relationships || [],
    athletes: athletes || [],
    interventions: interventions || [],
    protocols: protocols || [],
    races: races || [],
    settings: settings || [],
    activities: activities || [],
    groups: (groups || []).map((group) => ({
      ...group,
      color: sanitizeCoachGroupColor(group.color),
      color_style: getCoachGroupColorStyle(group.color, 'soft'),
    })),
  };
}

function buildAthleteDataMaps(base) {
  const athletesById = new Map(base.athletes.map((athlete) => [athlete.id, athlete]));
  const settingsByAthleteId = new Map(base.settings.map((setting) => [setting.athlete_id, setting]));
  const racesByAthleteId = base.races.reduce((accumulator, race) => {
    accumulator[race.athlete_id] = accumulator[race.athlete_id] || [];
    accumulator[race.athlete_id].push(race);
    return accumulator;
  }, {});
  const interventionsByAthleteId = base.interventions.reduce((accumulator, entry) => {
    accumulator[entry.athlete_id] = accumulator[entry.athlete_id] || [];
    accumulator[entry.athlete_id].push(entry);
    return accumulator;
  }, {});
  const protocolsByAthleteId = base.protocols.reduce((accumulator, protocol) => {
    accumulator[protocol.athlete_id] = accumulator[protocol.athlete_id] || [];
    accumulator[protocol.athlete_id].push(protocol);
    return accumulator;
  }, {});
  const activitiesByAthleteId = base.activities.reduce((accumulator, activity) => {
    accumulator[activity.athlete_id] = accumulator[activity.athlete_id] || [];
    accumulator[activity.athlete_id].push(activity);
    return accumulator;
  }, {});

  return {
    athletesById,
    settingsByAthleteId,
    racesByAthleteId,
    interventionsByAthleteId,
    protocolsByAthleteId,
    activitiesByAthleteId,
  };
}

export function buildAthleteRaceReadiness(relationship, dataMaps, groups = []) {
  const athlete = dataMaps.athletesById.get(relationship.athlete_id) || null;
  const interventions = dataMaps.interventionsByAthleteId[relationship.athlete_id] || [];
  const protocols = dataMaps.protocolsByAthleteId[relationship.athlete_id] || [];
  const races = dataMaps.racesByAthleteId[relationship.athlete_id] || [];
  const settings = dataMaps.settingsByAthleteId.get(relationship.athlete_id) || null;
  const activities = dataMaps.activitiesByAthleteId[relationship.athlete_id] || [];
  const groupRecord = getGroupRecordByName(groups, relationship.group_name);

  const upcomingRace =
    races.find((race) => race.id === athlete?.target_race_id && (differenceInDays(race.event_date) ?? -1) >= 0) ||
    races.find((race) => (differenceInDays(race.event_date) ?? -1) >= 0) ||
    null;

  const relevantProtocols = protocols.filter((protocol) => {
    if (!['assigned', 'in_progress', 'completed'].includes(protocol.status)) return false;
    if (!upcomingRace) return true;
    return !protocol.target_race_id || protocol.target_race_id === upcomingRace.id;
  });

  const protocolScores = relevantProtocols.map((protocol) => calculateProtocolComplianceFromEntries(protocol, interventions).compliance_percent);
  const protocolComplianceScore = clamp(average(protocolScores) ?? 0);

  const last28Days = interventions.filter((entry) => {
    const diff = differenceInDays(new Date(), entry.date || entry.inserted_at);
    return diff !== null && diff >= 0 && diff < 28;
  });
  const weeksWithEntries = new Set(last28Days.map((entry) => {
    const date = safeDate(entry.date || entry.inserted_at);
    if (!date) return null;
    const copy = startOfDay(date);
    const offset = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - offset);
    return copy.toISOString().slice(0, 10);
  }).filter(Boolean));
  const interventionConsistencyScore = clamp((weeksWithEntries.size / 4) * 100);

  const recentLoad = activities
    .filter((activity) => {
      const diff = differenceInDays(new Date(), activity.start_date);
      return diff !== null && diff >= 0 && diff < 21;
    })
    .reduce((total, activity) => total + Number(activity.kilojoules || activity.moving_time || 0), 0);
  const priorLoad = activities
    .filter((activity) => {
      const diff = differenceInDays(new Date(), activity.start_date);
      return diff !== null && diff >= 21 && diff < 42;
    })
    .reduce((total, activity) => total + Number(activity.kilojoules || activity.moving_time || 0), 0);
  const loadRatio = priorLoad > 0 ? recentLoad / priorLoad : recentLoad > 0 ? 1 : 0;
  const trainingLoadScore = clamp(
    loadRatio === 0
      ? 0
      : loadRatio >= 0.9 && loadRatio <= 1.15
        ? 92
        : loadRatio >= 0.75 && loadRatio < 0.9
          ? 75
          : loadRatio > 1.15 && loadRatio <= 1.35
            ? 70
            : 48
  );

  const sleepEntries = interventions.filter((entry) => entry.intervention_type === 'Sleep Protocol');
  const sleepLast14 = createEmptyWindowedValues(sleepEntries, (entry) => entry.date || entry.inserted_at, (entry) => entry.protocol_payload?.quality, 14);
  const sleepPrev14 = sleepEntries
    .filter((entry) => {
      const diff = differenceInDays(new Date(), entry.date || entry.inserted_at);
      return diff !== null && diff >= 14 && diff < 28;
    })
    .map((entry) => Number(entry.protocol_payload?.quality))
    .filter((value) => Number.isFinite(value) && value > 0);
  const recentSleepAvg = average(sleepLast14);
  const previousSleepAvg = average(sleepPrev14);
  const sleepQualityScore = clamp(
    recentSleepAvg === null
      ? Math.min(70, Number(settings?.typical_sleep_hours || 0) * 10)
      : (recentSleepAvg / 10) * 100
  );

  const gutEntries = interventions.filter((entry) => entry.intervention_type === 'Gut Training' || entry.intervention_type === 'Fueling - Mid-Effort');
  const latestGutEntry = gutEntries[0] || null;
  const gutActual = Number(
    latestGutEntry?.protocol_payload?.carb_actual_g_per_hr ||
    latestGutEntry?.protocol_payload?.carb_intake_g_per_hr ||
    settings?.normal_long_run_carb_g_per_hr ||
    0
  );
  const gutTarget = raceCarbTarget(upcomingRace?.race_type);
  const gutTrainingScore = clamp(
    gutTarget <= 0 ? 100 : (Math.min(gutActual, gutTarget) / gutTarget) * 100
  );

  const heatEntries = interventions.filter((entry) => entry.intervention_type === 'Heat Acclimation');
  const heatLast21Days = heatEntries.filter((entry) => {
    const diff = differenceInDays(new Date(), entry.date || entry.inserted_at);
    return diff !== null && diff >= 0 && diff < 21;
  });

  const readinessScore = clamp(
    protocolComplianceScore * READINESS_WEIGHTS.protocolCompliance +
    interventionConsistencyScore * READINESS_WEIGHTS.interventionConsistency +
    trainingLoadScore * READINESS_WEIGHTS.trainingLoad +
    sleepQualityScore * READINESS_WEIGHTS.sleepQuality +
    gutTrainingScore * READINESS_WEIGHTS.gutTraining
  );

  const risks = [];
  if (upcomingRace && gutEntries.length) {
    const firstGutDate = gutEntries
      .map((entry) => safeDate(entry.date || entry.inserted_at))
      .filter(Boolean)
      .sort((left, right) => left.getTime() - right.getTime())[0];
    const daysBeforeRaceStarted = firstGutDate ? differenceInDays(upcomingRace.event_date, firstGutDate) : null;
    if (daysBeforeRaceStarted !== null && daysBeforeRaceStarted < 28) {
      risks.push('Gut training started late');
    }
  } else if (upcomingRace) {
    risks.push('Gut training started late');
  }
  if (upcomingRace && differenceInDays(upcomingRace.event_date) !== null && differenceInDays(upcomingRace.event_date) <= 42 && heatLast21Days.length === 0) {
    risks.push('No heat sessions logged');
  }
  if (recentSleepAvg !== null && previousSleepAvg !== null && recentSleepAvg + 0.75 < previousSleepAvg) {
    risks.push('Sleep quality declining');
  }

  const actionItems = [];
  if (protocolComplianceScore < 70) {
    actionItems.push('Tighten protocol follow-through: reduce protocol volume or make target sessions more specific this week.');
  }
  if (heatLast21Days.length === 0 && upcomingRace) {
    actionItems.push('Schedule 2 to 3 heat sessions in the next 7 days if the target race is warm or exposed.');
  }
  if (gutTrainingScore < 80) {
    actionItems.push(`Add a gut session at ${Math.max(gutActual + 5, gutTarget ? Math.min(gutTarget, gutActual + 10) : gutActual + 5)} g/hr and review GI response.`);
  }
  if (sleepQualityScore < 65) {
    actionItems.push('Protect sleep this week: reduce late caffeine, shorten late intensity, and log bedtime routine compliance.');
  }
  if (trainingLoadScore < 60) {
    actionItems.push('Review the recent load trend. The athlete may be under-loading or carrying too much fatigue into race prep.');
  }

  const timeline = [];
  if (upcomingRace) {
    [56, 28, 7, 3].forEach((daysOut) => {
      const milestoneDate = safeDate(upcomingRace.event_date);
      milestoneDate?.setDate(milestoneDate.getDate() - daysOut);
      if (!milestoneDate) return;
      timeline.push({
        id: `milestone-${daysOut}`,
        label: daysOut === 56 ? '8 weeks out checkpoint' : daysOut === 28 ? '4 weeks out checkpoint' : daysOut === 7 ? 'Race-week review' : 'Carb-load window',
        date: milestoneDate.toISOString(),
        state: getTimelineState(milestoneDate),
      });
    });
  }

  relevantProtocols.forEach((protocol) => {
    const compliance = calculateProtocolComplianceFromEntries(protocol, interventions).compliance_percent;
    timeline.push({
      id: `protocol-${protocol.id}`,
      label: `${protocol.protocol_name} ${compliance >= protocol.compliance_target ? 'on target' : 'still open'}`,
      date: protocol.end_date,
      state: protocol.status === 'completed' || compliance >= protocol.compliance_target ? 'completed' : 'remaining',
    });
  });

  timeline.sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')));

  return {
    athleteId: relationship.athlete_id,
    athleteName: athlete?.name || 'Athlete',
    athleteInitials: getAthleteInitials(athlete?.name),
    groupName: relationship.group_name || 'Ungrouped',
    groupColor: groupRecord?.color || '#A8A29E',
    groupStyle: getCoachGroupColorStyle(groupRecord?.color || '#A8A29E', 'soft'),
    upcomingRace,
    readinessScore,
    breakdown: {
      protocolCompliance: clamp(protocolComplianceScore),
      interventionConsistency: clamp(interventionConsistencyScore),
      trainingLoad: clamp(trainingLoadScore),
      sleepQuality: clamp(sleepQualityScore),
      gutTraining: clamp(gutTrainingScore),
      heatPrep: clamp(Math.min(100, (heatLast21Days.length / 10) * 100)),
    },
    risks,
    actionItems,
    timeline,
    summaries: {
      activeProtocols: relevantProtocols.length,
      recentInterventions: last28Days.length,
      recentHeatSessions: heatLast21Days.length,
      recentSleepAvg: recentSleepAvg !== null ? recentSleepAvg.toFixed(1) : null,
      gutActual,
      gutTarget,
      loadRatio,
    },
    tones: {
      readiness: scoreFromThresholds(readinessScore, { green: 80, amber: 60 }),
      protocolCompliance: scoreFromThresholds(protocolComplianceScore, { green: 80, amber: 60 }),
      interventionConsistency: scoreFromThresholds(interventionConsistencyScore, { green: 75, amber: 50 }),
      trainingLoad: scoreFromThresholds(trainingLoadScore, { green: 75, amber: 55 }),
      sleepQuality: scoreFromThresholds(sleepQualityScore, { green: 75, amber: 60 }),
      gutTraining: scoreFromThresholds(gutTrainingScore, { green: 80, amber: 60 }),
    },
  };
}

export async function getCoachCohortData({ req }) {
  const base = await getCoachAnalyticsBase({ req });
  if (!base.authenticated) return base;

  const dataMaps = buildAthleteDataMaps(base);
  const readiness = base.relationships.map((relationship) => buildAthleteRaceReadiness(relationship, dataMaps, base.groups));

  const complianceRows = Array.from(
    new Set(
      base.protocols
        .filter((protocol) => ['assigned', 'in_progress'].includes(protocol.status))
        .map((protocol) => protocol.protocol_type)
        .filter(Boolean)
    )
  ).sort();

  const protocolComplianceRows = complianceRows.map((protocolType) => ({
    metric: protocolType,
    values: readiness.map((item) => {
      const athleteProtocols = (dataMaps.protocolsByAthleteId[item.athleteId] || []).filter((protocol) => (
        protocol.protocol_type === protocolType && ['assigned', 'in_progress'].includes(protocol.status)
      ));
      const compliances = athleteProtocols.map((protocol) => calculateProtocolComplianceFromEntries(protocol, dataMaps.interventionsByAthleteId[item.athleteId] || []).compliance_percent);
      const value = clamp(average(compliances) ?? 0);
      return {
        athleteId: item.athleteId,
        athleteName: item.athleteName,
        value,
        tone: scoreFromThresholds(value, { green: 80, amber: 60 }),
      };
    }),
  }));

  const interventionVolumeCategories = ['Check-in', 'Before', 'During', 'After', 'Other'];
  const interventionVolumeRows = interventionVolumeCategories.map((category) => ({
    metric: category,
    values: readiness.map((item) => {
      const value = (dataMaps.interventionsByAthleteId[item.athleteId] || []).filter((entry) => categorizeIntervention(entry.intervention_type) === category).length;
      return {
        athleteId: item.athleteId,
        athleteName: item.athleteName,
        value,
        tone: value >= 8 ? 'green' : value >= 3 ? 'amber' : 'red',
      };
    }),
  }));

  return {
    authenticated: true,
    profile: base.profile,
    groups: base.groups,
    athletes: readiness,
    comparison: {
      protocolComplianceRows,
      interventionVolumeRows,
      readinessRadar: readiness.map((item) => ({
        athleteId: item.athleteId,
        athleteName: item.athleteName,
        trainingLoad: item.breakdown.trainingLoad,
        heatPrep: item.breakdown.heatPrep,
        gutTraining: item.breakdown.gutTraining,
        sleepQuality: item.breakdown.sleepQuality,
        protocolCompliance: item.breakdown.protocolCompliance,
      })),
    },
    meta: {
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getCoachRaceReadinessPageData({ req, athleteId }) {
  const base = await getCoachAnalyticsBase({ req });
  if (!base.authenticated) return base;

  const relationship = base.relationships.find((item) => item.athlete_id === athleteId);
  if (!relationship) {
    return {
      authenticated: true,
      authorized: false,
    };
  }

  const dataMaps = buildAthleteDataMaps(base);
  const readiness = buildAthleteRaceReadiness(relationship, dataMaps, base.groups);
  const athlete = dataMaps.athletesById.get(athleteId) || null;

  return {
    authenticated: true,
    authorized: true,
    profile: base.profile,
    athlete,
    readiness,
    groups: base.groups,
    meta: {
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getCoachGroupsPageData({ req }) {
  const base = await getCoachAnalyticsBase({ req });
  if (!base.authenticated) return base;

  const dataMaps = buildAthleteDataMaps(base);
  const readinessByAthleteId = new Map(
    base.relationships.map((relationship) => [relationship.athlete_id, buildAthleteRaceReadiness(relationship, dataMaps, base.groups)])
  );

  const groupedAthletes = base.relationships.map((relationship) => {
    const athlete = dataMaps.athletesById.get(relationship.athlete_id) || null;
    const readiness = readinessByAthleteId.get(relationship.athlete_id);
    return {
      relationshipId: relationship.id,
      athleteId: relationship.athlete_id,
      athleteName: athlete?.name || 'Athlete',
      athleteInitials: getAthleteInitials(athlete?.name),
      groupName: relationship.group_name || 'Ungrouped',
      readinessScore: readiness?.readinessScore || 0,
      upcomingRace: readiness?.upcomingRace || null,
    };
  });

  return {
    authenticated: true,
    profile: base.profile,
    groups: base.groups,
    athletes: groupedAthletes,
    meta: {
      generatedAt: new Date().toISOString(),
    },
  };
}
