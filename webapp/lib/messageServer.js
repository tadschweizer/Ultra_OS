import { buildProtocolSummary } from './interventionCatalog';
import { getAthleteIdFromRequest, getSupabaseAdminClient } from './authServer';
import { getCoachProfileByAthleteId } from './coachServer';

const MESSAGE_SELECT =
  'id, sender_id, recipient_id, content, context_type, context_id, is_read, created_at';

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLabel(value) {
  const parsed = safeDate(value);
  if (!parsed) return 'No date';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return 'Schedule not set';
  if (!startDate) return `Ends ${formatDateLabel(endDate)}`;
  if (!endDate) return `Starts ${formatDateLabel(startDate)}`;
  return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`;
}

function truncate(value, maxLength = 120) {
  const content = String(value || '').trim();
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildContextHref(type, record, currentAthleteId) {
  if (!record?.id) return null;
  const isOwnRecord = record.athlete_id === currentAthleteId;

  if (type === 'intervention') {
    return isOwnRecord
      ? `/history?entry=${record.id}`
      : `/coach/athletes/${record.athlete_id}?tab=interventions&entry=${record.id}`;
  }

  if (type === 'protocol') {
    return isOwnRecord
      ? `/dashboard?protocol=${record.id}`
      : `/coach/athletes/${record.athlete_id}?tab=protocols&protocol=${record.id}`;
  }

  if (type === 'race') {
    return isOwnRecord
      ? `/race-plan?race=${record.id}`
      : `/coach/athletes/${record.athlete_id}?tab=race-prep&race=${record.id}`;
  }

  return null;
}

async function getAthleteById(admin, athleteId) {
  const { data, error } = await admin
    .from('athletes')
    .select('id, name, email, supabase_user_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getCurrentMessagingActor(req) {
  const admin = getSupabaseAdminClient();
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    return { admin, athlete: null, coachProfile: null };
  }

  const athlete = await getAthleteById(admin, athleteId);
  if (!athlete) {
    return { admin, athlete: null, coachProfile: null };
  }

  const coachProfile = await getCoachProfileByAthleteId(admin, athlete.id);
  return { admin, athlete, coachProfile };
}

export async function getMessageContacts(admin, currentAthlete) {
  const ownCoachProfile = await getCoachProfileByAthleteId(admin, currentAthlete.id);
  const contacts = new Map();

  if (ownCoachProfile) {
    const { data: coachRelationships, error: coachRelationshipError } = await admin
      .from('coach_athlete_relationships')
      .select('athlete_id, group_name')
      .eq('coach_id', ownCoachProfile.id)
      .eq('status', 'active');

    if (coachRelationshipError) throw coachRelationshipError;

    const athleteIds = [...new Set((coachRelationships || []).map((item) => item.athlete_id).filter(Boolean))];
    if (athleteIds.length) {
      const { data: athletes, error: athleteError } = await admin
        .from('athletes')
        .select('id, name, email, supabase_user_id')
        .in('id', athleteIds);

      if (athleteError) throw athleteError;

      (athletes || []).forEach((athlete) => {
        const relationship = (coachRelationships || []).find((item) => item.athlete_id === athlete.id);
        contacts.set(athlete.id, {
          athleteId: athlete.id,
          supabaseUserId: athlete.supabase_user_id || null,
          displayName: athlete.name || 'Athlete',
          role: 'athlete',
          subtitle: relationship?.group_name || 'Athlete',
          avatarUrl: null,
          href: `/messages?participant=${athlete.id}`,
        });
      });
    }
  }

  const { data: athleteRelationships, error: athleteRelationshipError } = await admin
    .from('coach_athlete_relationships')
    .select('coach_id')
    .eq('athlete_id', currentAthlete.id)
    .eq('status', 'active');

  if (athleteRelationshipError) throw athleteRelationshipError;

  const coachProfileIds = [...new Set((athleteRelationships || []).map((item) => item.coach_id).filter(Boolean))];
  if (coachProfileIds.length) {
    const { data: coachProfiles, error: coachProfileError } = await admin
      .from('coach_profiles')
      .select('id, athlete_id, display_name, avatar_url')
      .in('id', coachProfileIds);

    if (coachProfileError) throw coachProfileError;

    const coachAthleteIds = [...new Set((coachProfiles || []).map((profile) => profile.athlete_id).filter(Boolean))];
    const { data: coachAthletes, error: coachAthleteError } = coachAthleteIds.length
      ? await admin.from('athletes').select('id, name, email, supabase_user_id').in('id', coachAthleteIds)
      : { data: [], error: null };

    if (coachAthleteError) throw coachAthleteError;

    (coachProfiles || []).forEach((profile) => {
      const coachAthlete = (coachAthletes || []).find((item) => item.id === profile.athlete_id);
      if (!coachAthlete) return;
      contacts.set(coachAthlete.id, {
        athleteId: coachAthlete.id,
        supabaseUserId: coachAthlete.supabase_user_id || null,
        displayName: profile.display_name || coachAthlete.name || 'Coach',
        role: 'coach',
        subtitle: 'Coach',
        avatarUrl: profile.avatar_url || null,
        href: `/messages?participant=${coachAthlete.id}`,
      });
    });
  }

  const contactsList = Array.from(contacts.values()).sort((left, right) => {
    if (left.role !== right.role) return left.role === 'coach' ? -1 : 1;
    return left.displayName.localeCompare(right.displayName);
  });

  const userIdToContact = new Map(
    contactsList
      .filter((contact) => contact.supabaseUserId)
      .map((contact) => [contact.supabaseUserId, contact])
  );

  return { ownCoachProfile, contacts: contactsList, userIdToContact };
}

async function hydrateMessageContexts(admin, messages, currentAthleteId) {
  const interventionIds = [...new Set(messages.filter((item) => item.context_type === 'intervention' && item.context_id).map((item) => item.context_id))];
  const protocolIds = [...new Set(messages.filter((item) => item.context_type === 'protocol' && item.context_id).map((item) => item.context_id))];
  const raceIds = [...new Set(messages.filter((item) => item.context_type === 'race' && item.context_id).map((item) => item.context_id))];

  const [{ data: interventions, error: interventionError }, { data: protocols, error: protocolError }, { data: races, error: raceError }] = await Promise.all([
    interventionIds.length
      ? admin
          .from('interventions')
          .select('id, athlete_id, intervention_type, date, inserted_at, protocol_payload')
          .in('id', interventionIds)
      : { data: [], error: null },
    protocolIds.length
      ? admin
          .from('assigned_protocols')
          .select('id, athlete_id, protocol_name, protocol_type, start_date, end_date, races(id, name)')
          .in('id', protocolIds)
      : { data: [], error: null },
    raceIds.length
      ? admin
          .from('races')
          .select('id, athlete_id, name, event_date')
          .in('id', raceIds)
      : { data: [], error: null },
  ]);

  if (interventionError) throw interventionError;
  if (protocolError) throw protocolError;
  if (raceError) throw raceError;

  const contextMap = new Map();

  (interventions || []).forEach((entry) => {
    const dateLabel = formatDateLabel(entry.date || entry.inserted_at);
    contextMap.set(`intervention:${entry.id}`, {
      title: `Re: ${buildProtocolSummary(entry.intervention_type, entry.protocol_payload)}`,
      subtitle: `${entry.intervention_type} — ${dateLabel}`,
      href: buildContextHref('intervention', entry, currentAthleteId),
    });
  });

  (protocols || []).forEach((protocol) => {
    contextMap.set(`protocol:${protocol.id}`, {
      title: `Re: ${protocol.protocol_name}`,
      subtitle: `${protocol.protocol_type} — ${formatDateRange(protocol.start_date, protocol.end_date)}`,
      href: buildContextHref('protocol', protocol, currentAthleteId),
    });
  });

  (races || []).forEach((race) => {
    contextMap.set(`race:${race.id}`, {
      title: `Re: ${race.name}`,
      subtitle: formatDateLabel(race.event_date),
      href: buildContextHref('race', race, currentAthleteId),
    });
  });

  return contextMap;
}

function normalizeMessage(message, currentUserId, userIdToContact, contextMap) {
  const outgoing = message.sender_id === currentUserId;
  const counterpartUserId = outgoing ? message.recipient_id : message.sender_id;
  const counterpart = userIdToContact.get(counterpartUserId) || null;
  const senderRole = outgoing
    ? (counterpart?.role === 'coach' ? 'athlete' : 'coach')
    : (counterpart?.role || 'athlete');

  return {
    ...message,
    outgoing,
    counterpart_athlete_id: counterpart?.athleteId || null,
    counterpart_name: counterpart?.displayName || 'Unknown',
    counterpart_role: counterpart?.role || 'athlete',
    sender_role: senderRole,
    preview: truncate(message.content, 96),
    context: message.context_type && message.context_id
      ? contextMap.get(`${message.context_type}:${message.context_id}`) || null
      : null,
  };
}

export async function listThreadsForAthlete(admin, currentAthlete) {
  const { contacts, userIdToContact } = await getMessageContacts(admin, currentAthlete);
  if (!currentAthlete?.supabase_user_id) {
    return { contacts, threads: [], messages: [] };
  }

  const { data, error } = await admin
    .from('coach_athlete_messages')
    .select(MESSAGE_SELECT)
    .or(`sender_id.eq.${currentAthlete.supabase_user_id},recipient_id.eq.${currentAthlete.supabase_user_id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const contextMap = await hydrateMessageContexts(admin, data || [], currentAthlete.id);
  const allowedUserIds = new Set(Array.from(userIdToContact.keys()));
  const visibleMessages = (data || [])
    .filter((message) => {
      const counterpartUserId = message.sender_id === currentAthlete.supabase_user_id ? message.recipient_id : message.sender_id;
      return allowedUserIds.has(counterpartUserId);
    })
    .map((message) => normalizeMessage(message, currentAthlete.supabase_user_id, userIdToContact, contextMap));

  const threadMap = new Map();
  visibleMessages.forEach((message) => {
    const key = message.counterpart_athlete_id;
    if (!key) return;
    const existing = threadMap.get(key);
    if (!existing) {
      threadMap.set(key, {
        participant: contacts.find((contact) => contact.athleteId === key) || null,
        lastMessage: message,
        unreadCount: !message.outgoing && !message.is_read ? 1 : 0,
      });
      return;
    }

    if (!existing.lastMessage || new Date(message.created_at) > new Date(existing.lastMessage.created_at)) {
      existing.lastMessage = message;
    }
    if (!message.outgoing && !message.is_read) {
      existing.unreadCount += 1;
    }
  });

  const threads = Array.from(threadMap.values()).sort(
    (left, right) => new Date(right.lastMessage?.created_at || 0) - new Date(left.lastMessage?.created_at || 0)
  );

  return { contacts, threads, messages: visibleMessages };
}

export async function listConversationForAthlete(admin, currentAthlete, participantAthleteId) {
  const { contacts, messages } = await listThreadsForAthlete(admin, currentAthlete);
  return {
    contacts,
    participant: contacts.find((contact) => contact.athleteId === participantAthleteId) || null,
    messages: messages.filter((message) => message.counterpart_athlete_id === participantAthleteId),
  };
}

export async function markConversationRead(admin, currentAthlete, participantAthleteId) {
  const { contacts } = await getMessageContacts(admin, currentAthlete);
  const participant = contacts.find((contact) => contact.athleteId === participantAthleteId);
  if (!participant?.supabaseUserId || !currentAthlete?.supabase_user_id) {
    return 0;
  }

  const { data, error } = await admin
    .from('coach_athlete_messages')
    .update({ is_read: true })
    .eq('recipient_id', currentAthlete.supabase_user_id)
    .eq('sender_id', participant.supabaseUserId)
    .eq('is_read', false)
    .select('id');

  if (error) throw error;
  return (data || []).length;
}

async function validateMessageContext(admin, { currentAthlete, recipientAthleteId, contextType, contextId }) {
  if (!contextType || !contextId || contextType === 'general') return true;

  if (contextType === 'intervention') {
    const { data, error } = await admin
      .from('interventions')
      .select('id, athlete_id')
      .eq('id', contextId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data && [currentAthlete.id, recipientAthleteId].includes(data.athlete_id));
  }

  if (contextType === 'protocol') {
    const { data, error } = await admin
      .from('assigned_protocols')
      .select('id, athlete_id')
      .eq('id', contextId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data && [currentAthlete.id, recipientAthleteId].includes(data.athlete_id));
  }

  if (contextType === 'race') {
    const { data, error } = await admin
      .from('races')
      .select('id, athlete_id')
      .eq('id', contextId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data && [currentAthlete.id, recipientAthleteId].includes(data.athlete_id));
  }

  return false;
}

export async function createMessage(admin, currentAthlete, payload) {
  const content = String(payload?.content || '').trim();
  const recipientAthleteId = payload?.recipient_athlete_id;
  const contextType = payload?.context_type || 'general';
  const contextId = payload?.context_id || null;

  if (!currentAthlete?.supabase_user_id) {
    throw new Error('Your account is not linked to a messaging-enabled login yet.');
  }
  if (!recipientAthleteId) {
    throw new Error('A recipient is required.');
  }
  if (!content) {
    throw new Error('Message content is required.');
  }

  const { contacts } = await getMessageContacts(admin, currentAthlete);
  const recipient = contacts.find((contact) => contact.athleteId === recipientAthleteId);
  if (!recipient) {
    throw new Error('You can only message connected coaches or athletes.');
  }
  if (!recipient.supabaseUserId) {
    throw new Error('That person has not finished setting up their Threshold login yet.');
  }

  const validContext = await validateMessageContext(admin, {
    currentAthlete,
    recipientAthleteId,
    contextType,
    contextId,
  });

  if (!validContext) {
    throw new Error('That message context does not belong to this coach-athlete relationship.');
  }

  const { data, error } = await admin
    .from('coach_athlete_messages')
    .insert({
      sender_id: currentAthlete.supabase_user_id,
      recipient_id: recipient.supabaseUserId,
      content,
      context_type: contextType === 'general' ? null : contextType,
      context_id: contextId,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error) throw error;

  const contextMap = await hydrateMessageContexts(admin, [data], currentAthlete.id);
  const userIdToContact = new Map([[recipient.supabaseUserId, recipient]]);

  return normalizeMessage(data, currentAthlete.supabase_user_id, userIdToContact, contextMap);
}

export async function countUnreadMessagesForAthlete(admin, currentAthlete) {
  if (!currentAthlete?.supabase_user_id) return 0;

  const { count, error } = await admin
    .from('coach_athlete_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', currentAthlete.supabase_user_id)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

async function attachContextMessagesByType(admin, currentAthlete, rows, contextType, idKey) {
  if (!currentAthlete?.supabase_user_id || !rows.length) {
    return rows.map((row) => ({ ...row, context_messages: [] }));
  }

  const ids = rows.map((row) => row[idKey]).filter(Boolean);
  if (!ids.length) {
    return rows.map((row) => ({ ...row, context_messages: [] }));
  }

  const { data, error } = await admin
    .from('coach_athlete_messages')
    .select(MESSAGE_SELECT)
    .eq('context_type', contextType)
    .in('context_id', ids)
    .or(`sender_id.eq.${currentAthlete.supabase_user_id},recipient_id.eq.${currentAthlete.supabase_user_id}`)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const { userIdToContact } = await getMessageContacts(admin, currentAthlete);
  const contextMap = await hydrateMessageContexts(admin, data || [], currentAthlete.id);
  const grouped = (data || []).reduce((accumulator, message) => {
    const key = message.context_id;
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(normalizeMessage(message, currentAthlete.supabase_user_id, userIdToContact, contextMap));
    return accumulator;
  }, {});

  return rows.map((row) => ({
    ...row,
    context_messages: grouped[row[idKey]] || [],
  }));
}

export async function attachInterventionMessages(admin, currentAthlete, interventions = []) {
  return attachContextMessagesByType(admin, currentAthlete, interventions, 'intervention', 'id');
}

export async function attachProtocolMessages(admin, currentAthlete, protocols = []) {
  return attachContextMessagesByType(admin, currentAthlete, protocols, 'protocol', 'id');
}
