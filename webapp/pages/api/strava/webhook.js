import { getSupabaseAdminClient } from '../../../lib/authServer';
import {
  markActivityEventStatus,
  normalizeStravaWebhookEvent,
  recordActivityEvent,
  upsertActivityFollowUpPrompts,
  upsertProviderConnection,
} from '../../../lib/providerEvents';
import { syncAthleteStravaActivities } from '../../../lib/stravaSync';

function getChallengeValue(req) {
  return req.query['hub.challenge'] || req.query.hub_challenge || null;
}

function getVerifyToken(req) {
  return req.query['hub.verify_token'] || req.query.hub_verify_token || null;
}

function getMode(req) {
  return req.query['hub.mode'] || req.query.hub_mode || null;
}

async function findAthleteForOwner(admin, ownerId) {
  const normalizedOwnerId = String(ownerId || '');
  if (!normalizedOwnerId) return { athlete: null, connection: null };

  const { data: connection } = await admin
    .from('provider_connections')
    .select('id, athlete_id, provider, provider_athlete_id')
    .eq('provider', 'strava')
    .eq('provider_athlete_id', normalizedOwnerId)
    .maybeSingle();

  if (connection?.athlete_id) {
    const { data: athlete, error } = await admin
      .from('athletes')
      .select('id, strava_id, access_token, refresh_token, token_expires_at, strava_last_sync')
      .eq('id', connection.athlete_id)
      .maybeSingle();

    if (error) throw error;
    return { athlete, connection };
  }

  const { data: athlete, error } = await admin
    .from('athletes')
    .select('id, strava_id, access_token, refresh_token, token_expires_at, strava_last_sync')
    .eq('strava_id', normalizedOwnerId)
    .maybeSingle();

  if (error) throw error;
  return { athlete, connection: null };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
    const mode = getMode(req);
    const challenge = getChallengeValue(req);
    const providedToken = getVerifyToken(req);

    if (mode !== 'subscribe' || !verifyToken || providedToken !== verifyToken || !challenge) {
      res.status(403).json({ error: 'Webhook verification failed.' });
      return;
    }

    res.status(200).json({ 'hub.challenge': challenge });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const incomingEvents = Array.isArray(req.body) ? req.body : req.body ? [req.body] : [];
  const results = [];

  for (const incomingEvent of incomingEvents) {
    const normalizedEvent = normalizeStravaWebhookEvent(incomingEvent);
    const externalEventId = normalizedEvent.externalEventId;
    let eventRecord = null;

    try {
      const { athlete, connection } = await findAthleteForOwner(admin, incomingEvent.owner_id);
      const providerConnection = athlete
        ? await upsertProviderConnection(admin, {
            athleteId: athlete.id,
            provider: 'strava',
            providerAthleteId: incomingEvent.owner_id,
            accessToken: athlete.access_token || null,
            refreshToken: athlete.refresh_token || null,
            tokenExpiresAt: athlete.token_expires_at || null,
            lastWebhookAt: new Date().toISOString(),
            lastError: null,
            metadata: {
              webhook_subscription_id: incomingEvent.subscription_id || null,
            },
          })
        : connection;

      eventRecord = await recordActivityEvent(admin, {
        athleteId: athlete?.id || null,
        providerConnectionId: providerConnection?.id || null,
        provider: normalizedEvent.provider,
        eventKind: normalizedEvent.eventKind,
        externalEventId: normalizedEvent.externalEventId,
        externalActivityId: normalizedEvent.externalActivityId,
        providerAthleteId: normalizedEvent.providerAthleteId,
        occurredAt: normalizedEvent.occurredAt,
        payload: normalizedEvent.payload,
      });

      if (!athlete?.id) {
        await markActivityEventStatus(admin, eventRecord.id, {
          status: 'ignored',
          processingNotes: 'No athlete matches this Strava owner id yet.',
        });
        results.push({ externalEventId, status: 'ignored', reason: 'unknown_athlete' });
        continue;
      }

      if (incomingEvent.object_type !== 'activity') {
        await markActivityEventStatus(admin, eventRecord.id, {
          status: 'ignored',
          processingNotes: 'Only activity events are processed right now.',
        });
        results.push({ externalEventId, status: 'ignored', reason: 'unsupported_object_type' });
        continue;
      }

      if (incomingEvent.aspect_type === 'delete') {
        await markActivityEventStatus(admin, eventRecord.id, {
          status: 'ignored',
          processingNotes: 'Delete events are recorded but not applied yet.',
        });
        results.push({ externalEventId, status: 'ignored', reason: 'delete_not_implemented' });
        continue;
      }

      await syncAthleteStravaActivities({
        admin,
        athlete,
        force: true,
      });

      const { data: activity, error: activityError } = await admin
        .from('strava_activities')
        .select('*')
        .eq('athlete_id', athlete.id)
        .eq('strava_activity_id', String(incomingEvent.object_id))
        .maybeSingle();

      if (activityError) throw activityError;

      if (activity) {
        await upsertActivityFollowUpPrompts(admin, {
          athleteId: athlete.id,
          activityEventId: eventRecord.id,
          provider: 'strava',
          activity,
        });
      }

      await markActivityEventStatus(admin, eventRecord.id, {
        status: 'processed',
        processingNotes: activity
          ? 'Activity synced and follow-up prompts refreshed.'
          : 'Activity sync completed; cached activity not found yet.',
      });
      results.push({ externalEventId, status: 'processed', activityFound: Boolean(activity) });
    } catch (error) {
      console.error('[strava/webhook] event failed:', incomingEvent, error);
      if (eventRecord?.id) {
        await markActivityEventStatus(admin, eventRecord.id, {
          status: 'error',
          processingNotes: error.message || 'Webhook processing failed.',
        }).catch(() => null);
      }
      results.push({ externalEventId, status: 'error', error: error.message || 'Webhook processing failed.' });
    }
  }

  res.status(200).json({
    received: incomingEvents.length,
    processed: results.filter((item) => item.status === 'processed').length,
    ignored: results.filter((item) => item.status === 'ignored').length,
    failed: results.filter((item) => item.status === 'error').length,
    results,
  });
}
