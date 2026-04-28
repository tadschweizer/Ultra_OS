import { getSupabaseAdminClient } from './authServer';

const SUPPORTED_PROVIDERS = ['strava', 'garmin', 'trainingpeaks'];
const PROMPT_KIND_CONFIG = {
  workout_check_in: {
    type: 'Workout Check-in',
  },
  intervention_log: {
    type: null,
  },
};

function normalizeProvider(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.includes(normalized)) {
    throw new Error(`Unsupported activity provider: ${provider}`);
  }
  return normalized;
}

function buildStravaEventId(event = {}) {
  return [
    'strava',
    event.subscription_id || 'subscription',
    event.owner_id || 'owner',
    event.object_type || 'object',
    event.object_id || 'id',
    event.aspect_type || 'aspect',
    event.event_time || 'time',
  ].join(':');
}

export function getProviderLabel(provider) {
  const normalizedProvider = normalizeProvider(provider);
  const labels = {
    strava: 'Strava',
    garmin: 'Garmin',
    trainingpeaks: 'TrainingPeaks',
  };
  return labels[normalizedProvider] || normalizedProvider;
}

export function buildProviderActivityPromptHref({
  provider,
  providerActivityId,
  promptKind,
}) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedPromptKind = String(promptKind || '').trim();
  const promptConfig = PROMPT_KIND_CONFIG[normalizedPromptKind] || {};
  const params = new URLSearchParams({
    activity: String(providerActivityId || ''),
    provider: normalizedProvider,
  });

  if (promptConfig.type) {
    params.set('type', promptConfig.type);
  }

  return `/log-intervention?${params.toString()}`;
}

function coerceProviderActivityId(activity = {}) {
  return String(
    activity?.provider_activity_id ||
      activity?.strava_activity_id ||
      activity?.external_activity_id ||
      activity?.id ||
      ''
  );
}

function buildActivityPromptMetadata(activity = {}, existingMetadata = {}) {
  return {
    ...(existingMetadata || {}),
    activity_name: String(
      activity.name || activity.activity_type || activity.sport_type || 'Workout'
    ).trim(),
    sport_type: activity.sport_type || activity.activity_type || null,
    moving_time: activity.moving_time ?? null,
    distance: activity.distance ?? null,
  };
}

function buildPromptCopy({ activityName, sportType, movingTimeMinutes, distanceMiles }) {
  const normalizedSport = String(sportType || '').toLowerCase();
  const formattedMinutes = movingTimeMinutes ? `${movingTimeMinutes} min` : null;
  const formattedDistance = distanceMiles ? `${distanceMiles.toFixed(1)} mi` : null;
  const contextParts = [formattedDistance, formattedMinutes].filter(Boolean).join(' • ');
  const contextLabel = contextParts ? ` (${contextParts})` : '';

  const workoutCheckIn = {
    prompt_kind: 'workout_check_in',
    title: `${activityName} is ready for a check-in`,
    body: `Log a Workout Check-in for ${activityName}${contextLabel} while the session still feels fresh.`,
  };

  const interventionPrompt = {
    prompt_kind: 'intervention_log',
    title: `Log any protocol used around ${activityName}`,
    body:
      normalizedSport === 'run' || normalizedSport === 'trailrun' || normalizedSport === 'ride'
        ? `Capture fueling, hydration, recovery, or prep details tied to ${activityName} so later comparisons have real context.`
        : `Capture any intervention around ${activityName} so later comparisons are tied to a real training event.`,
  };

  return [workoutCheckIn, interventionPrompt];
}

export function normalizeStravaWebhookEvent(event = {}) {
  return {
    provider: 'strava',
    eventKind: `${event.object_type || 'unknown'}.${event.aspect_type || 'received'}`,
    externalEventId: buildStravaEventId(event),
    externalActivityId: event.object_id ? String(event.object_id) : null,
    providerAthleteId: event.owner_id ? String(event.owner_id) : null,
    occurredAt: event.event_time
      ? new Date(Number(event.event_time) * 1000).toISOString()
      : new Date().toISOString(),
    payload: event,
  };
}

export async function upsertProviderConnection(
  admin = getSupabaseAdminClient(),
  {
    athleteId,
    provider,
    providerAthleteId = null,
    status = 'connected',
    scopes = [],
    accessToken = null,
    refreshToken = null,
    tokenExpiresAt = null,
    metadata = {},
    lastWebhookAt = null,
    lastSyncAt = null,
    lastError = null,
  }
) {
  const normalizedProvider = normalizeProvider(provider);
  if (!athleteId) {
    throw new Error('upsertProviderConnection requires athleteId.');
  }

  let query = admin
    .from('provider_connections')
    .select('id, athlete_id, provider, provider_athlete_id, metadata')
    .eq('provider', normalizedProvider)
    .eq('athlete_id', athleteId)
    .limit(1);

  if (providerAthleteId) {
    query = admin
      .from('provider_connections')
      .select('id, athlete_id, provider, provider_athlete_id, metadata')
      .eq('provider', normalizedProvider)
      .eq('provider_athlete_id', String(providerAthleteId))
      .limit(1);
  }

  const { data: rows, error: lookupError } = await query;
  if (lookupError) throw lookupError;

  const payload = {
    athlete_id: athleteId,
    provider: normalizedProvider,
    provider_athlete_id: providerAthleteId ? String(providerAthleteId) : null,
    status,
    scopes: Array.isArray(scopes) ? scopes : [],
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiresAt,
    last_webhook_at: lastWebhookAt,
    last_sync_at: lastSyncAt,
    last_error: lastError,
    metadata,
    updated_at: new Date().toISOString(),
  };

  const existing = rows?.[0];
  if (existing?.id) {
    const { data, error } = await admin
      .from('provider_connections')
      .update({
        ...payload,
        metadata: {
          ...(existing.metadata || {}),
          ...(metadata || {}),
        },
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from('provider_connections')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function recordActivityEvent(
  admin = getSupabaseAdminClient(),
  {
    athleteId = null,
    providerConnectionId = null,
    provider,
    eventKind,
    externalEventId,
    externalActivityId = null,
    providerAthleteId = null,
    occurredAt = null,
    payload = {},
    eventStatus = 'received',
    processingNotes = null,
  }
) {
  const normalizedProvider = normalizeProvider(provider);
  const eventId =
    externalEventId ||
    (normalizedProvider === 'strava' ? buildStravaEventId(payload) : `${normalizedProvider}:${Date.now()}`);

  const { data: existing, error: existingError } = await admin
    .from('activity_events')
    .select('id')
    .eq('provider', normalizedProvider)
    .eq('external_event_id', eventId)
    .maybeSingle();

  if (existingError) throw existingError;

  const nextPayload = {
    athlete_id: athleteId,
    provider_connection_id: providerConnectionId,
    provider: normalizedProvider,
    event_kind: eventKind,
    event_status: eventStatus,
    external_event_id: eventId,
    external_activity_id: externalActivityId ? String(externalActivityId) : null,
    provider_athlete_id: providerAthleteId ? String(providerAthleteId) : null,
    occurred_at: occurredAt,
    payload,
    processing_notes: processingNotes,
    updated_at: new Date().toISOString(),
  };

  if (eventStatus === 'processed' || eventStatus === 'ignored' || eventStatus === 'error') {
    nextPayload.processed_at = new Date().toISOString();
  }

  if (existing?.id) {
    const { data, error } = await admin
      .from('activity_events')
      .update(nextPayload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from('activity_events')
    .insert(nextPayload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function markActivityEventStatus(
  admin = getSupabaseAdminClient(),
  eventId,
  { status, processingNotes = null }
) {
  if (!eventId) return null;

  const update = {
    event_status: status,
    processing_notes: processingNotes,
    updated_at: new Date().toISOString(),
  };

  if (status === 'processed' || status === 'ignored' || status === 'error') {
    update.processed_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from('activity_events')
    .update(update)
    .eq('id', eventId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function upsertActivityFollowUpPrompts(
  admin = getSupabaseAdminClient(),
  {
    athleteId,
    activityEventId = null,
    provider,
    activity,
  }
) {
  const normalizedProvider = normalizeProvider(provider);
  const providerActivityId = coerceProviderActivityId(activity);

  if (!athleteId || !providerActivityId) {
    return [];
  }
  const activityName = String(activity.name || activity.activity_type || activity.sport_type || 'Workout').trim();
  const movingTimeMinutes = activity.moving_time ? Math.round(Number(activity.moving_time) / 60) : null;
  const distanceMiles = activity.distance ? Number(activity.distance) / 1609.344 : null;
  const prompts = buildPromptCopy({
    activityName,
    sportType: activity.sport_type || activity.activity_type,
    movingTimeMinutes,
    distanceMiles,
  });
  const occurredAt = activity.start_date || new Date().toISOString();

  const results = [];
  for (const prompt of prompts) {
    const { data: existing, error: existingError } = await admin
      .from('activity_follow_up_prompts')
      .select('id, metadata')
      .eq('athlete_id', athleteId)
      .eq('provider', normalizedProvider)
      .eq('provider_activity_id', providerActivityId)
      .eq('prompt_kind', prompt.prompt_kind)
      .maybeSingle();

    if (existingError) throw existingError;

    const nextPayload = {
      athlete_id: athleteId,
      activity_event_id: activityEventId,
      provider: normalizedProvider,
      provider_activity_id: providerActivityId,
      prompt_kind: prompt.prompt_kind,
      title: prompt.title,
      body: prompt.body,
      href: buildProviderActivityPromptHref({
        provider: normalizedProvider,
        providerActivityId,
        promptKind: prompt.prompt_kind,
      }),
      occurred_at: occurredAt,
      metadata: buildActivityPromptMetadata(activity, existing?.metadata),
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { data, error } = await admin
        .from('activity_follow_up_prompts')
        .update(nextPayload)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      results.push(data);
      continue;
    }

    const { data, error } = await admin
      .from('activity_follow_up_prompts')
      .insert(nextPayload)
      .select('*')
      .single();

    if (error) throw error;
    results.push(data);
  }

  return results;
}

export async function listActivityFollowUpPrompts(
  admin = getSupabaseAdminClient(),
  {
    athleteId,
    status = 'pending',
    limit = 20,
  }
) {
  if (!athleteId) return [];

  const query = admin
    .from('activity_follow_up_prompts')
    .select('id, provider, provider_activity_id, prompt_kind, status, title, body, href, metadata, occurred_at, updated_at')
    .eq('athlete_id', athleteId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (status) {
    query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function updateActivityFollowUpPromptStatus(
  admin = getSupabaseAdminClient(),
  {
    athleteId,
    promptId,
    status,
  }
) {
  if (!athleteId || !promptId) {
    return null;
  }

  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (!['pending', 'dismissed', 'completed'].includes(normalizedStatus)) {
    throw new Error(`Unsupported prompt status: ${status}`);
  }

  const { data, error } = await admin
    .from('activity_follow_up_prompts')
    .update({
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', promptId)
    .eq('athlete_id', athleteId)
    .select('id, provider, provider_activity_id, prompt_kind, status, title, body, href, metadata, occurred_at, updated_at')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function completeActivityFollowUpPrompts(
  admin = getSupabaseAdminClient(),
  {
    athleteId,
    provider,
    providerActivityId,
    interventionType = null,
  }
) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedActivityId = String(providerActivityId || '').trim();
  if (!athleteId || !normalizedActivityId) {
    return [];
  }

  const promptKinds = [];
  if (interventionType === 'Workout Check-in') {
    promptKinds.push('workout_check_in');
  } else if (interventionType) {
    promptKinds.push('intervention_log');
  }

  if (!promptKinds.length) {
    return [];
  }

  const { data, error } = await admin
    .from('activity_follow_up_prompts')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('athlete_id', athleteId)
    .eq('provider', normalizedProvider)
    .eq('provider_activity_id', normalizedActivityId)
    .in('prompt_kind', promptKinds)
    .select('id, provider, provider_activity_id, prompt_kind, status');

  if (error) throw error;
  return data || [];
}
