import { buildUsageSnapshot, getSubscriptionTierLabel, normalizeSubscriptionTier } from '../../lib/subscriptionTiers';
import { getAthleteIdFromRequest, getSupabaseAdminClient, syncAdminAccessCookie } from '../../lib/authServer';
import { syncAthleteSubscriptionFromStripe } from '../../lib/billingSync';
import { countUnreadMessagesForAthlete } from '../../lib/messageServer';


/**
 * Returns the authenticated athlete profile plus subscription tier and usage.
 */
export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  const admin = getSupabaseAdminClient();
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  // Fetch athlete
  const { data: athlete, error: athleteError } = await admin
    .from('athletes')
    .select('id, name, email, strava_id, strava_last_sync, strava_sync_status, strava_sync_error, onboarding_complete, primary_sports, years_racing_band, weekly_training_hours_band, home_elevation_ft, target_race_id, is_admin, subscription_tier, supabase_user_id, stripe_customer_id, stripe_subscription_id, stripe_subscription_status')
    .eq('id', athleteId)
    .single();
  if (athleteError) {
    console.error(athleteError);
    res.status(500).json({ error: athleteError.message });
    return;
  }
  const { count, error: interventionsError } = await admin
    .from('interventions')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', athleteId);
  if (interventionsError) {
    console.error(interventionsError);
    res.status(500).json({ error: interventionsError.message });
    return;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: weeklyCheckIns, error: weeklyError } = await admin
    .from('interventions')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', athleteId)
    .eq('intervention_type', 'Workout Check-in')
    .gte('inserted_at', sevenDaysAgo.toISOString());

  if (weeklyError) {
    console.error(weeklyError);
    res.status(500).json({ error: weeklyError.message });
    return;
  }

  const { data: providerConnections, error: providerConnectionsError } = await admin
    .from('provider_connections')
    .select('provider, status, connected_at, last_sync_at, last_webhook_at, last_error')
    .eq('athlete_id', athleteId);

  if (providerConnectionsError) {
    console.warn('[me] provider connection lookup failed:', providerConnectionsError.message);
  }

  let hydratedAthlete = athlete;
  try {
    hydratedAthlete = await syncAthleteSubscriptionFromStripe({ athlete });
  } catch (error) {
    console.warn('[me] billing hydration failed, using stored athlete tier:', error.message);
  }
  const normalizedTier = normalizeSubscriptionTier(hydratedAthlete.subscription_tier);
  let authMethods = hydratedAthlete.supabase_user_id ? ['email'] : [];

  if (hydratedAthlete.supabase_user_id) {
    try {
      const admin = getSupabaseAdminClient();
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(hydratedAthlete.supabase_user_id);

      if (userError) {
        console.warn('[me] could not load auth identities:', userError.message);
      } else {
        const identities = userData?.user?.identities || [];
        const providerSet = new Set();

        identities.forEach((identity) => {
          if (identity?.provider) {
            providerSet.add(identity.provider);
          }
        });

        if (!providerSet.size && userData?.user?.app_metadata?.providers?.length) {
          userData.user.app_metadata.providers.forEach((provider) => providerSet.add(provider));
        }

        authMethods = Array.from(providerSet);
      }
    } catch (error) {
      console.warn('[me] auth identity lookup failed:', error);
    }
  }

  const providerConnectionMap = (providerConnections || []).reduce((accumulator, connection) => {
    accumulator[connection.provider] = connection;
    return accumulator;
  }, {});

  const connectionStatuses = [
    {
      id: 'strava',
      label: 'Strava',
      type: 'training-data',
      status: providerConnectionMap.strava?.status || (hydratedAthlete.strava_id ? 'connected' : 'available'),
      actionLabel: hydratedAthlete.strava_id ? 'Reconnect' : 'Connect',
      href: '/api/strava/login?link=1',
      lastSyncAt: providerConnectionMap.strava?.last_sync_at || hydratedAthlete.strava_last_sync || null,
      lastWebhookAt: providerConnectionMap.strava?.last_webhook_at || null,
      lastError: providerConnectionMap.strava?.last_error || hydratedAthlete.strava_sync_error || null,
    },
    {
      id: 'garmin',
      label: 'Garmin',
      type: 'training-data',
      status: providerConnectionMap.garmin?.status || 'coming_soon',
      actionLabel: 'Coming soon',
      href: '/connections',
      lastSyncAt: providerConnectionMap.garmin?.last_sync_at || null,
      lastWebhookAt: providerConnectionMap.garmin?.last_webhook_at || null,
      lastError: providerConnectionMap.garmin?.last_error || null,
    },
    {
      id: 'coros',
      label: 'COROS',
      type: 'training-data',
      status: 'coming_soon',
      actionLabel: 'Coming soon',
      href: '/connections',
      lastSyncAt: null,
      lastWebhookAt: null,
      lastError: null,
    },
    {
      id: 'zwift',
      label: 'Zwift',
      type: 'training-data',
      status: 'coming_soon',
      actionLabel: 'Coming soon',
      href: '/connections',
      lastSyncAt: null,
      lastWebhookAt: null,
      lastError: null,
    },
    {
      id: 'trainingpeaks',
      label: 'TrainingPeaks',
      type: 'training-data',
      status: providerConnectionMap.trainingpeaks?.status || 'coming_soon',
      actionLabel: 'Coming soon',
      href: '/connections',
      lastSyncAt: providerConnectionMap.trainingpeaks?.last_sync_at || null,
      lastWebhookAt: providerConnectionMap.trainingpeaks?.last_webhook_at || null,
      lastError: providerConnectionMap.trainingpeaks?.last_error || null,
    },
  ];

  const normalizedAthlete = {
    ...hydratedAthlete,
    subscription_tier: normalizedTier,
    subscription_label: getSubscriptionTierLabel(normalizedTier),
    auth_provider: hydratedAthlete.supabase_user_id ? 'supabase' : hydratedAthlete.strava_id ? 'strava' : null,
  };

  const { data: coachProfile } = await admin
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code, avatar_url, onboarding_completed, max_athletes, subscription_status, subscription_tier, subscription_current_period_end')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  const { data: coachLinks } = await admin
    .from('coach_athlete_links')
    .select('id, coach_id, role, status, created_at')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  const coachIds = (coachLinks || []).map((link) => link.coach_id);
  const { data: coachProfiles } = coachIds.length
    ? await admin
        .from('coach_profiles')
        .select('id, athlete_id, display_name, coach_code, avatar_url')
        .in('id', coachIds)
    : { data: [] };

  const primaryCoachLink = (coachLinks || []).find((link) => link.role === 'primary') || coachLinks?.[0] || null;
  const primaryCoach = primaryCoachLink
    ? (coachProfiles || []).find((profile) => profile.id === primaryCoachLink.coach_id) || null
    : null;

  syncAdminAccessCookie(res, normalizedAthlete);
  let unreadMessageCount = 0;
  let unreadNotificationCount = 0;
  try {
    unreadMessageCount = await countUnreadMessagesForAthlete(admin, normalizedAthlete);
  } catch (error) {
    console.warn('[me] unread message count failed:', error.message);
  }

  try {
    const { count: unreadNotifications, error: unreadNotificationError } = await admin
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_athlete_id', athleteId)
      .eq('is_archived', false)
      .eq('is_read', false);

    if (unreadNotificationError) {
      throw unreadNotificationError;
    }

    unreadNotificationCount = unreadNotifications || 0;
  } catch (error) {
    console.warn('[me] unread notification count failed:', error.message);
  }

  res.status(200).json({
    athlete: normalizedAthlete,
    coachProfile: coachProfile || null,
    coachConnections: (coachLinks || []).map((link) => ({
      ...link,
      coach: (coachProfiles || []).find((profile) => profile.id === link.coach_id) || null,
    })),
    primaryCoach,
    authMethods,
    connectionStatuses,
    interventionCount: count ?? 0,
    weeklyCheckIns: weeklyCheckIns ?? 0,
    unreadMessageCount,
    unreadNotificationCount,
    usage: buildUsageSnapshot({
      athlete: normalizedAthlete,
      interventionCount: count ?? 0,
      weeklyCheckIns: weeklyCheckIns ?? 0,
    }),
  });
}
