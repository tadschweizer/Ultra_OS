import { getCoachDashboardData } from './coachDashboard';
import { listThreadsForAthlete } from './messageServer';
import { getCurrentMessagingActor } from './messageServer';

function toIso(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function flattenContextNotifications(items = [], type) {
  return items.flatMap((item) =>
    (item.context_messages || [])
      .filter((message) => !message.outgoing)
      .map((message) => ({
        source_type: type === 'protocol' ? 'protocol_comment' : 'intervention_comment',
        source_key: message.id,
        title: type === 'protocol'
          ? `Protocol comment on ${item.protocol_name}`
          : `Intervention comment on ${item.summary || item.intervention_type}`,
        body: message.content,
        href: type === 'protocol' ? `/dashboard?protocol=${item.id}` : `/history?entry=${item.id}`,
        badge: type === 'protocol' ? 'Protocol' : 'Intervention',
        occurred_at: toIso(message.created_at),
        metadata: {
          context_id: item.id,
          message_id: message.id,
        },
      }))
  );
}

function buildMessageNotifications(threads = []) {
  return threads
    .filter((thread) => thread.unreadCount > 0 && thread.lastMessage?.id)
    .map((thread) => ({
      source_type: 'message_thread',
      source_key: thread.lastMessage.id,
      title: `Unread message from ${thread.participant?.displayName || 'your contact'}`,
      body: thread.lastMessage?.preview || 'Open the conversation to read the latest message.',
      href: `/messages?participant=${thread.participant?.athleteId}`,
      badge: thread.unreadCount > 1 ? `${thread.unreadCount} unread` : 'Message',
      occurred_at: toIso(thread.lastMessage?.created_at),
      metadata: {
        participant_athlete_id: thread.participant?.athleteId || null,
        thread_unread_count: thread.unreadCount,
      },
    }));
}

function buildCoachAlertNotifications(dashboard = null) {
  return (dashboard?.alerts || []).map((alert) => ({
    source_type: 'coach_alert',
    source_key: alert.id,
    title: alert.title,
    body: `${alert.athleteName}: ${alert.body}`,
    href: alert.href,
    badge: 'Coach feed',
    occurred_at: toIso(alert.timestamp),
    metadata: {
      athlete_id: alert.athleteId,
      level: alert.level,
    },
  }));
}

export async function upsertUserNotification(admin, payload) {
  const normalizedPayload = {
    recipient_athlete_id: payload.recipient_athlete_id,
    source_type: payload.source_type,
    source_key: String(payload.source_key),
    title: payload.title,
    body: payload.body,
    href: payload.href || null,
    badge: payload.badge || null,
    occurred_at: toIso(payload.occurred_at),
    metadata: payload.metadata || {},
  };

  const { data: existing, error: existingError } = await admin
    .from('user_notifications')
    .select('id')
    .eq('recipient_athlete_id', normalizedPayload.recipient_athlete_id)
    .eq('source_type', normalizedPayload.source_type)
    .eq('source_key', normalizedPayload.source_key)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error: updateError } = await admin
      .from('user_notifications')
      .update({
        title: normalizedPayload.title,
        body: normalizedPayload.body,
        href: normalizedPayload.href,
        badge: normalizedPayload.badge,
        occurred_at: normalizedPayload.occurred_at,
        metadata: normalizedPayload.metadata,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
    return existing.id;
  }

  const { data: inserted, error: insertError } = await admin
    .from('user_notifications')
    .insert(normalizedPayload)
    .select('id')
    .single();

  if (insertError) throw insertError;
  return inserted?.id || null;
}

export async function archiveWorkoutUploadNotification(admin, athleteId, activityId) {
  if (!athleteId || !activityId) return null;

  const { data, error } = await admin
    .from('user_notifications')
    .update({
      is_archived: true,
      is_read: true,
    })
    .eq('recipient_athlete_id', athleteId)
    .eq('source_type', 'workout_upload')
    .eq('source_key', String(activityId))
    .eq('is_archived', false)
    .select('id');

  if (error) throw error;
  return data || [];
}

export async function createWorkoutUploadNotification(admin, {
  athleteId,
  activity,
}) {
  if (!athleteId || !activity?.strava_activity_id) return null;

  const activityName = String(activity.name || activity.activity_type || activity.sport_type || 'Workout').trim();
  const activityDate = safeDate(activity.start_date);
  const dateLabel = activityDate
    ? activityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'today';

  return upsertUserNotification(admin, {
    recipient_athlete_id: athleteId,
    source_type: 'workout_upload',
    source_key: activity.strava_activity_id,
    title: `${activityName} is ready for a check-in`,
    body: `Your Strava workout from ${dateLabel} just loaded. Open Threshold and log a Workout Check-in while the session is still fresh.`,
    href: `/log-intervention?type=${encodeURIComponent('Workout Check-in')}&activity=${encodeURIComponent(activity.strava_activity_id)}`,
    badge: 'Workout',
    occurred_at: activity.start_date || new Date().toISOString(),
    metadata: {
      activity_id: String(activity.strava_activity_id),
      activity_name: activityName,
      start_date: activity.start_date || null,
    },
  });
}

async function fetchProtocolNotifications(admin, athleteId) {
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

  const { attachProtocolMessages } = await import('./messageServer');
  const protocolAssignments = (protocols || []).map((protocol) => ({
    ...protocol,
    coach_name: protocol.coach_profiles?.display_name || 'Coach',
  }));

  return attachProtocolMessages(admin, athlete, protocolAssignments);
}

async function fetchInterventionNotifications(admin, athleteId) {
  const [{ data: athlete, error: athleteError }, { data: interventions, error: interventionError }] = await Promise.all([
    admin
      .from('athletes')
      .select('id, name, email, supabase_user_id')
      .eq('id', athleteId)
      .maybeSingle(),
    admin
      .from('interventions')
      .select('id, athlete_id, date, inserted_at, intervention_type, details, dose_duration, timing, protocol_payload, assigned_protocol_id, gi_response, physical_response, subjective_feel, activity_id, training_phase, target_race, target_race_date, race_id, notes, races(id, name, event_date, race_type, distance_miles, elevation_gain_ft, location, surface, notes)')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false })
      .order('inserted_at', { ascending: false })
      .limit(20),
  ]);

  if (athleteError) throw athleteError;
  if (interventionError) throw interventionError;

  const { attachInterventionMessages } = await import('./messageServer');
  const { buildProtocolSummary } = await import('./interventionCatalog');
  return attachInterventionMessages(admin, athlete, (interventions || []).map((entry) => ({
    ...entry,
    summary: buildProtocolSummary(entry.intervention_type, entry.protocol_payload),
  })));
}

export async function syncNotificationsForCurrentUser(req) {
  const { admin, athlete, coachProfile } = await getCurrentMessagingActor(req);
  if (!athlete) {
    return { athlete: null, notifications: [], unreadCount: 0 };
  }

  const [{ threads }, protocolAssignments, interventions, coachDashboard] = await Promise.all([
    listThreadsForAthlete(admin, athlete),
    fetchProtocolNotifications(admin, athlete.id),
    fetchInterventionNotifications(admin, athlete.id),
    coachProfile ? getCoachDashboardData({ athleteId: athlete.id }) : Promise.resolve(null),
  ]);

  const sourceNotifications = [
    ...buildMessageNotifications(threads),
    ...flattenContextNotifications(protocolAssignments, 'protocol'),
    ...flattenContextNotifications(interventions, 'intervention'),
    ...buildCoachAlertNotifications(coachDashboard),
  ];

  for (const item of sourceNotifications) {
    await upsertUserNotification(admin, {
      recipient_athlete_id: athlete.id,
      source_type: item.source_type,
      source_key: item.source_key,
      title: item.title,
      body: item.body,
      href: item.href,
      badge: item.badge,
      occurred_at: item.occurred_at,
      metadata: item.metadata,
    });
  }

  const { data: notifications, error: notificationError } = await admin
    .from('user_notifications')
    .select('id, source_type, source_key, title, body, href, badge, occurred_at, is_read, is_archived, metadata, created_at, updated_at')
    .eq('recipient_athlete_id', athlete.id)
    .eq('is_archived', false)
    .order('occurred_at', { ascending: false });

  if (notificationError) throw notificationError;

  const unreadCount = (notifications || []).filter((item) => !item.is_read).length;

  return {
    athlete,
    notifications: notifications || [],
    unreadCount,
    sourceCounts: {
      messages: (notifications || []).filter((item) => item.source_type === 'message_thread').length,
      contextComments: (notifications || []).filter((item) => item.source_type === 'protocol_comment' || item.source_type === 'intervention_comment').length,
      coachAlerts: (notifications || []).filter((item) => item.source_type === 'coach_alert').length,
      workoutUploads: (notifications || []).filter((item) => item.source_type === 'workout_upload').length,
    },
  };
}

export async function updateNotificationState({ req, id, action }) {
  const { admin, athlete } = await getCurrentMessagingActor(req);
  if (!athlete) {
    return { athlete: null };
  }

  const updates = {};
  if (action === 'read') updates.is_read = true;
  if (action === 'unread') updates.is_read = false;
  if (action === 'archive') updates.is_archived = true;
  if (action === 'restore') updates.is_archived = false;

  const { data, error } = await admin
    .from('user_notifications')
    .update(updates)
    .eq('id', id)
    .eq('recipient_athlete_id', athlete.id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return { athlete, updated: data || null };
}
