import { getAthleteIdFromRequest, getSupabaseAdminClient } from './authServer';
import { ensureCoachProfile } from './coachServer';
import { calculateProtocolComplianceFromEntries } from './protocolAssignmentEngine';

const EMPTY_SUMMARY = {
  total_athletes: 0,
  active_protocols: 0,
  athletes_needing_attention: 0,
  upcoming_races: 0,
};

const GROUP_PILL_STYLES = [
  'bg-amber-100 text-amber-900',
  'bg-sky-100 text-sky-900',
  'bg-emerald-100 text-emerald-900',
  'bg-rose-100 text-rose-900',
  'bg-violet-100 text-violet-900',
  'bg-stone-200 text-stone-800',
];

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function toDateOnly(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return String(value);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function differenceInDays(targetDate, baseDate = startOfToday()) {
  const target = safeDate(targetDate);
  if (!target) return null;
  const normalizedTarget = new Date(target);
  normalizedTarget.setHours(0, 0, 0, 0);
  return Math.round((normalizedTarget.getTime() - baseDate.getTime()) / 86400000);
}

function daysSince(dateValue) {
  const diff = differenceInDays(dateValue);
  return diff === null ? null : diff * -1;
}

function formatDateLabel(value) {
  const parsed = safeDate(value);
  if (!parsed) return 'Unknown date';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(value) {
  const parsed = safeDate(value);
  if (!parsed) return 'No logs yet';

  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'Yesterday';
  }

  return `${days}d ago`;
}

function truncateMessage(value, maxLength = 120) {
  const content = String(value || '').trim();
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength - 1).trimEnd()}…`;
}

function getRosterStatus(daysInactive) {
  if (daysInactive === null) {
    return 'red';
  }

  if (daysInactive <= 0) {
    return 'green';
  }

  if (daysInactive >= 7) {
    return 'red';
  }

  return 'amber';
}

function getAttentionPriority(level) {
  if (level === 'red') return 0;
  if (level === 'amber') return 1;
  if (level === 'blue') return 2;
  return 3;
}

function getSeverityBorder(level) {
  if (level === 'red') return 'border-red-500';
  if (level === 'amber') return 'border-amber-400';
  if (level === 'blue') return 'border-sky-500';
  return 'border-emerald-500';
}

function getSeverityBadge(level) {
  if (level === 'red') return 'bg-red-100 text-red-800';
  if (level === 'amber') return 'bg-amber-100 text-amber-900';
  if (level === 'blue') return 'bg-sky-100 text-sky-900';
  return 'bg-emerald-100 text-emerald-900';
}

function buildInitials(name) {
  const parts = String(name || 'Athlete')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'A';
}

function hashString(value) {
  return Array.from(String(value || '')).reduce((total, character) => total + character.charCodeAt(0), 0);
}

function getGroupPillClass(groupName) {
  if (!groupName) {
    return 'bg-stone-200 text-stone-800';
  }

  return GROUP_PILL_STYLES[hashString(groupName) % GROUP_PILL_STYLES.length];
}

function buildRosterItem(relationship, athlete, interventions, races, protocols) {
  const orderedInterventions = [...interventions].sort((left, right) => {
    return new Date(right.date || right.inserted_at || 0).getTime() - new Date(left.date || left.inserted_at || 0).getTime();
  });

  const lastIntervention = orderedInterventions[0] || null;
  const lastActiveAt = lastIntervention?.date || lastIntervention?.inserted_at || null;
  const daysInactive = lastActiveAt ? daysSince(lastActiveAt) : null;
  const rosterStatus = getRosterStatus(daysInactive);

  const futureRaces = races
    .filter((race) => differenceInDays(race.event_date) !== null && differenceInDays(race.event_date) >= 0)
    .sort((left, right) => new Date(left.event_date).getTime() - new Date(right.event_date).getTime());

  const nextRace = futureRaces[0] || null;
  const activeProtocols = protocols.filter((protocol) => ['assigned', 'in_progress'].includes(protocol.status));

  return {
    id: relationship.id,
    athleteId: relationship.athlete_id,
    athleteName: athlete?.name || 'Athlete',
    athleteEmail: athlete?.email || '',
    initials: buildInitials(athlete?.name),
    avatarUrl: null,
    href: `/coach/athletes/${relationship.athlete_id}`,
    groupName: relationship.group_name || 'Ungrouped',
    groupClassName: getGroupPillClass(relationship.group_name || 'Ungrouped'),
    lastActiveAt,
    lastActiveLabel: formatRelativeTime(lastActiveAt),
    daysInactive,
    status: rosterStatus,
    nextRace,
    activeProtocols,
  };
}

function compareAlerts(left, right) {
  const priorityDelta = getAttentionPriority(left.level) - getAttentionPriority(right.level);
  if (priorityDelta !== 0) return priorityDelta;

  const leftDate = safeDate(left.sortDate || left.timestamp);
  const rightDate = safeDate(right.sortDate || right.timestamp);
  return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
}

export async function getCoachDashboardData({ req, athleteId: explicitAthleteId } = {}) {
  const admin = getSupabaseAdminClient();
  const athleteId = explicitAthleteId || getAthleteIdFromRequest(req);

  if (!athleteId) {
    return { authenticated: false };
  }

  const { data: athlete, error: athleteError } = await admin
    .from('athletes')
    .select('id, name, email, subscription_tier, supabase_user_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (athleteError) {
    throw athleteError;
  }

  if (!athlete) {
    return { authenticated: false };
  }

  const profile = await ensureCoachProfile(admin, athlete);

  const [{ data: rpcData, error: summaryError }, { data: relationships, error: relationshipError }] = await Promise.all([
    admin.rpc('get_coach_dashboard_summary', { coach_uuid: profile.id }),
    admin
      .from('coach_athlete_relationships')
      .select('id, athlete_id, status, group_name, notes, invited_at, accepted_at, created_at')
      .eq('coach_id', profile.id)
      .eq('status', 'active')
      .order('accepted_at', { ascending: true, nullsFirst: false }),
  ]);

  if (summaryError) {
    throw summaryError;
  }

  if (relationshipError) {
    throw relationshipError;
  }

  const summary = (Array.isArray(rpcData) ? rpcData[0] : rpcData) || EMPTY_SUMMARY;
  const athleteIds = (relationships || []).map((item) => item.athlete_id);
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const previousMonthStart = new Date(currentMonthStart);
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

  if (!athleteIds.length) {
    return {
      authenticated: true,
      profile,
      metrics: {
        totalAthletes: {
          value: 0,
          delta: 0,
          detail: 'No active athletes yet',
        },
        activeProtocols: {
          value: 0,
        },
        avgProtocolCompliance: {
          value: 0,
          tone: 'red',
        },
        athletesNeedingAttention: {
          value: 0,
          tone: 'green',
        },
      },
      alerts: [],
      roster: [],
      races: [],
      meta: {
        generatedAt: new Date().toISOString(),
      },
      summary,
    };
  }

  const earliestProtocolQueryDate = new Date();
  earliestProtocolQueryDate.setMonth(earliestProtocolQueryDate.getMonth() - 4);

  const [
    { data: athletes, error: athletesError },
    { data: interventions, error: interventionsError },
    { data: races, error: racesError },
    { data: protocols, error: protocolsError },
  ] = await Promise.all([
    admin
      .from('athletes')
      .select('id, name, email, created_at, supabase_user_id')
      .in('id', athleteIds),
    admin
      .from('interventions')
      .select('id, athlete_id, intervention_type, date, inserted_at')
      .in('athlete_id', athleteIds)
      .gte('inserted_at', earliestProtocolQueryDate.toISOString())
      .order('inserted_at', { ascending: false }),
    admin
      .from('races')
      .select('id, athlete_id, name, event_date, race_type, distance_miles, location')
      .in('athlete_id', athleteIds)
      .order('event_date', { ascending: true }),
    admin
      .from('assigned_protocols')
      .select('id, athlete_id, protocol_name, protocol_type, start_date, end_date, status, compliance_target, created_at, updated_at, target_race_id')
      .eq('coach_id', profile.id)
      .in('athlete_id', athleteIds)
      .order('start_date', { ascending: false }),
  ]);

  if (athletesError) throw athletesError;
  if (interventionsError) throw interventionsError;
  if (racesError) throw racesError;
  if (protocolsError) throw protocolsError;

  const athleteMap = new Map((athletes || []).map((item) => [item.id, item]));
  const athleteByUserId = new Map(
    (athletes || [])
      .filter((item) => item.supabase_user_id)
      .map((item) => [item.supabase_user_id, item])
  );
  const interventionsByAthlete = (interventions || []).reduce((accumulator, item) => {
    accumulator[item.athlete_id] = accumulator[item.athlete_id] || [];
    accumulator[item.athlete_id].push(item);
    return accumulator;
  }, {});
  const racesByAthlete = (races || []).reduce((accumulator, item) => {
    accumulator[item.athlete_id] = accumulator[item.athlete_id] || [];
    accumulator[item.athlete_id].push(item);
    return accumulator;
  }, {});
  const protocolsByAthlete = (protocols || []).reduce((accumulator, item) => {
    accumulator[item.athlete_id] = accumulator[item.athlete_id] || [];
    accumulator[item.athlete_id].push(item);
    return accumulator;
  }, {});

  const roster = (relationships || []).map((relationship) =>
    buildRosterItem(
      relationship,
      athleteMap.get(relationship.athlete_id),
      interventionsByAthlete[relationship.athlete_id] || [],
      racesByAthlete[relationship.athlete_id] || [],
      protocolsByAthlete[relationship.athlete_id] || []
    )
  );

  const activeProtocols = (protocols || []).filter((protocol) => ['assigned', 'in_progress'].includes(protocol.status));
  const activeProtocolCompliance = activeProtocols.map((protocol) => {
    const compliance = calculateProtocolComplianceFromEntries(protocol, interventionsByAthlete[protocol.athlete_id] || []);
    return {
      ...protocol,
      compliance: compliance.compliance_percent,
    };
  });

  const avgCompliance = activeProtocolCompliance.length
    ? Math.round(activeProtocolCompliance.reduce((total, protocol) => total + protocol.compliance, 0) / activeProtocolCompliance.length)
    : 0;

  const avgComplianceTone = avgCompliance > 80 ? 'green' : avgCompliance >= 60 ? 'amber' : 'red';

  const athletesBeforeCurrentMonth = (relationships || []).filter((relationship) => {
    const joinedAt = safeDate(relationship.accepted_at || relationship.created_at);
    return joinedAt && joinedAt < currentMonthStart;
  }).length;

  const totalAthleteDelta = summary.total_athletes - athletesBeforeCurrentMonth;
  const attentionAthleteIds = new Set();
  const alerts = [];

  roster.forEach((item) => {
    if (item.daysInactive === null || item.daysInactive >= 7) {
      attentionAthleteIds.add(item.athleteId);
      alerts.push({
        id: `stale-${item.athleteId}`,
        level: 'red',
        athleteId: item.athleteId,
        athleteName: item.athleteName,
        initials: item.initials,
        href: item.href,
        title: 'No log entries in 7+ days',
        body: item.lastActiveAt
          ? `Last active ${formatDateLabel(item.lastActiveAt)}`
          : 'No activity logged yet',
        timestamp: item.lastActiveAt || item.nextRace?.event_date || new Date().toISOString(),
        timestampLabel: item.lastActiveAt ? formatRelativeTime(item.lastActiveAt) : 'No logs yet',
        sortDate: item.lastActiveAt || null,
      });
    }
  });

  activeProtocolCompliance.forEach((protocol) => {
    if (protocol.compliance < 60) {
      const athleteName = athleteMap.get(protocol.athlete_id)?.name || 'Athlete';
      attentionAthleteIds.add(protocol.athlete_id);
      alerts.push({
        id: `compliance-${protocol.id}`,
        level: 'amber',
        athleteId: protocol.athlete_id,
        athleteName,
        initials: buildInitials(athleteName),
        href: `/coach-command-center?athleteId=${protocol.athlete_id}`,
        title: 'Protocol compliance below 60%',
        body: `${protocol.protocol_name} is at ${protocol.compliance}%`,
        timestamp: protocol.updated_at || protocol.start_date,
        timestampLabel: protocol.updated_at ? formatRelativeTime(protocol.updated_at) : formatDateLabel(protocol.start_date),
        sortDate: protocol.updated_at || protocol.start_date,
      });
    }
  });

  (races || []).forEach((race) => {
    const daysUntilRace = differenceInDays(race.event_date);
    if (daysUntilRace !== null && daysUntilRace >= 0 && daysUntilRace < 14) {
      const athleteName = athleteMap.get(race.athlete_id)?.name || 'Athlete';
      alerts.push({
        id: `race-${race.id}`,
        level: 'blue',
        athleteId: race.athlete_id,
        athleteName,
        initials: buildInitials(athleteName),
        href: `/coach-command-center?athleteId=${race.athlete_id}`,
        title: 'Race in under 14 days',
        body: `${race.name} on ${formatDateLabel(race.event_date)}`,
        timestamp: race.event_date,
        timestampLabel: daysUntilRace === 0 ? 'Race day' : `${daysUntilRace}d away`,
        sortDate: race.event_date,
      });
    }
  });

  (protocols || []).forEach((protocol) => {
    const updatedAt = safeDate(protocol.updated_at || protocol.end_date);
    const daysAgo = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 86400000) : null;
    if (protocol.status === 'completed' && daysAgo !== null && daysAgo <= 14) {
      const athleteName = athleteMap.get(protocol.athlete_id)?.name || 'Athlete';
      alerts.push({
        id: `completed-${protocol.id}`,
        level: 'green',
        athleteId: protocol.athlete_id,
        athleteName,
        initials: buildInitials(athleteName),
        href: `/coach-command-center?athleteId=${protocol.athlete_id}`,
        title: 'Protocol completed',
        body: `${protocol.protocol_name} was marked complete`,
        timestamp: protocol.updated_at || protocol.end_date,
        timestampLabel: protocol.updated_at ? formatRelativeTime(protocol.updated_at) : formatDateLabel(protocol.end_date),
        sortDate: protocol.updated_at || protocol.end_date,
      });
    }
  });

  if (athlete.supabase_user_id) {
    const senderIds = (athletes || []).map((item) => item.supabase_user_id).filter(Boolean);
    if (senderIds.length) {
      const { data: unreadMessages, error: unreadMessageError } = await admin
        .from('coach_athlete_messages')
        .select('id, sender_id, content, created_at')
        .eq('recipient_id', athlete.supabase_user_id)
        .eq('is_read', false)
        .in('sender_id', senderIds)
        .order('created_at', { ascending: false });

      if (unreadMessageError) throw unreadMessageError;

      const latestBySender = new Map();
      (unreadMessages || []).forEach((message) => {
        if (!latestBySender.has(message.sender_id)) {
          latestBySender.set(message.sender_id, message);
        }
      });

      latestBySender.forEach((message, senderId) => {
        const senderAthlete = athleteByUserId.get(senderId);
        if (!senderAthlete) return;

        alerts.push({
          id: `message-${message.id}`,
          level: 'amber',
          athleteId: senderAthlete.id,
          athleteName: senderAthlete.name || 'Athlete',
          initials: buildInitials(senderAthlete.name),
          href: `/messages?participant=${senderAthlete.id}`,
          title: 'Unread message waiting',
          body: truncateMessage(message.content),
          timestamp: message.created_at,
          timestampLabel: formatRelativeTime(message.created_at),
          sortDate: message.created_at,
        });
      });
    }
  }

  const timelineRaces = (races || [])
    .filter((race) => differenceInDays(race.event_date) !== null && differenceInDays(race.event_date) >= 0)
    .map((race) => {
      const athleteName = athleteMap.get(race.athlete_id)?.name || 'Athlete';
      const daysUntilRace = differenceInDays(race.event_date);
      return {
        id: race.id,
        athleteId: race.athlete_id,
        athleteName,
        raceName: race.name,
        date: race.event_date,
        dateLabel: formatDateLabel(race.event_date),
        daysUntilRace,
        href: `/coach-command-center?athleteId=${race.athlete_id}`,
      };
    })
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  const earliestTimelineDate = timelineRaces[0]?.date;
  const latestTimelineDate = timelineRaces[timelineRaces.length - 1]?.date;
  const timelineSpan = Math.max(1, differenceInDays(latestTimelineDate, safeDate(earliestTimelineDate) || startOfToday()) || 1);

  const racesWithPositions = timelineRaces.map((race) => {
    const offset = Math.max(
      0,
      differenceInDays(race.date, safeDate(earliestTimelineDate) || startOfToday()) || 0
    );

    return {
      ...race,
      position: timelineRaces.length === 1 ? 50 : Math.round((offset / timelineSpan) * 100),
    };
  });

  const sortedAlerts = alerts.sort(compareAlerts);

  return {
    authenticated: true,
    profile,
    metrics: {
      totalAthletes: {
        value: summary.total_athletes,
        delta: totalAthleteDelta,
        detail: totalAthleteDelta === 0
          ? 'No change from last month'
          : `${totalAthleteDelta > 0 ? '+' : ''}${totalAthleteDelta} vs last month`,
      },
      activeProtocols: {
        value: summary.active_protocols,
      },
      avgProtocolCompliance: {
        value: avgCompliance,
        tone: avgComplianceTone,
      },
      athletesNeedingAttention: {
        value: attentionAthleteIds.size,
        tone: attentionAthleteIds.size > 0 ? 'amber' : 'green',
      },
    },
    alerts: sortedAlerts.map((alert) => ({
      ...alert,
      borderClassName: getSeverityBorder(alert.level),
      badgeClassName: getSeverityBadge(alert.level),
    })),
    roster,
    races: racesWithPositions,
    meta: {
      generatedAt: new Date().toISOString(),
      previousMonthStart: previousMonthStart.toISOString(),
      currentMonthStart: currentMonthStart.toISOString(),
    },
    summary: {
      ...summary,
      athletes_needing_attention: attentionAthleteIds.size,
    },
  };
}
