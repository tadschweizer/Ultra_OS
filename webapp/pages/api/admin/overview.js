import { createClient } from '@supabase/supabase-js';
import { normalizeSubscriptionTier } from '../../../lib/subscriptionTiers';
import { requireAdminRequest } from '../../../lib/authServer';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role config');
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function isActiveSubscriptionStatus(status) {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

function sortNewest(items, field) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a?.[field] || 0).getTime();
    const bTime = new Date(b?.[field] || 0).getTime();
    return bTime - aTime;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const adminContext = await requireAdminRequest(req, res);
  if (!adminContext) return;

  try {
    const supabase = getAdminClient();
    const sevenDaysAgo = isoDaysAgo(7);
    const thirtyDaysAgo = isoDaysAgo(30);

    const [
      athletesResponse,
      interventions7Response,
      interventions30Response,
      recentActivityResponse,
      invitesResponse,
      coachProfilesResponse,
      coachLinksResponse,
      researchResponse,
      stravaAccountsResponse,
      stravaActivities30Response,
      stravaActivitiesTotalResponse,
    ] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, name, email, created_at, onboarding_complete, subscription_tier, stripe_subscription_status, is_admin, strava_id, strava_last_sync, strava_sync_status'),
      supabase
        .from('interventions')
        .select('athlete_id, inserted_at')
        .gte('inserted_at', sevenDaysAgo),
      supabase
        .from('interventions')
        .select('athlete_id, inserted_at, intervention_type')
        .gte('inserted_at', thirtyDaysAgo),
      supabase
        .from('interventions')
        .select('id, athlete_id, inserted_at, intervention_type, athletes(name)')
        .order('inserted_at', { ascending: false })
        .limit(20),
      supabase
        .from('invites')
        .select('id, email, created_at, used_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('coach_profiles')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('coach_athlete_links')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('research_library_entries')
        .select('id', { count: 'exact', head: true })
        .eq('published', true),
      supabase
        .from('athletes')
        .select('id', { count: 'exact', head: true })
        .not('strava_id', 'is', null),
      supabase
        .from('strava_activities')
        .select('id, athlete_id, inserted_at')
        .gte('inserted_at', thirtyDaysAgo),
      supabase
        .from('strava_activities')
        .select('id', { count: 'exact', head: true }),
    ]);

    const responses = [
      athletesResponse,
      interventions7Response,
      interventions30Response,
      recentActivityResponse,
      invitesResponse,
      coachProfilesResponse,
      coachLinksResponse,
      researchResponse,
      stravaAccountsResponse,
      stravaActivities30Response,
      stravaActivitiesTotalResponse,
    ];

    const failedResponse = responses.find((response) => response.error);
    if (failedResponse?.error) {
      throw failedResponse.error;
    }

    const athletes = athletesResponse.data || [];
    const interventionsLast7 = interventions7Response.data || [];
    const interventionsLast30 = interventions30Response.data || [];
    const recentActivity = recentActivityResponse.data || [];
    const invites = invitesResponse.data || [];
    const stravaActivitiesLast30 = stravaActivities30Response.data || [];

    const activeAthleteIds7 = new Set(interventionsLast7.map((item) => item.athlete_id).filter(Boolean));
    const syncedAthleteIds30 = new Set(stravaActivitiesLast30.map((item) => item.athlete_id).filter(Boolean));
    const newAthletes7 = athletes.filter((athlete) => athlete.created_at && athlete.created_at >= sevenDaysAgo);
    const newAthletes30 = athletes.filter((athlete) => athlete.created_at && athlete.created_at >= thirtyDaysAgo);
    const onboardedCount = athletes.filter((athlete) => athlete.onboarding_complete).length;
    const paidAthletes = athletes.filter((athlete) => isActiveSubscriptionStatus(athlete.stripe_subscription_status));
    const adminCount = athletes.filter((athlete) => athlete.is_admin).length;
    const staleStravaConnections = athletes.filter((athlete) => athlete.strava_id && (!athlete.strava_last_sync || athlete.strava_sync_status === 'error')).length;

    const planBreakdown = athletes.reduce((accumulator, athlete) => {
      const tier = normalizeSubscriptionTier(athlete.subscription_tier);
      accumulator[tier] = (accumulator[tier] || 0) + 1;
      return accumulator;
    }, {});

    const interventionTypeMap = interventionsLast30.reduce((accumulator, intervention) => {
      const key = intervention.intervention_type || 'Unknown';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    const topInterventionTypes = Object.entries(interventionTypeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    const usedInvites = invites.filter((invite) => Boolean(invite.used_at)).length;
    const pendingInvites = invites.filter((invite) => !invite.used_at).length;
    const inviteConversionRate = invites.length ? Math.round((usedInvites / invites.length) * 100) : 0;

    const recentSignups = sortNewest(athletes, 'created_at').slice(0, 6).map((athlete) => ({
      id: athlete.id,
      name: athlete.name || 'Unnamed athlete',
      email: athlete.email || 'No email',
      created_at: athlete.created_at,
      onboarding_complete: athlete.onboarding_complete,
      subscription_tier: normalizeSubscriptionTier(athlete.subscription_tier),
    }));

    const alerts = [];
    if (athletes.length > 0 && onboardedCount / athletes.length < 0.6) {
      alerts.push({
        id: 'onboarding',
        title: 'Onboarding completion is below 60%',
        detail: 'A large share of new accounts are not finishing setup.',
        tone: 'warning',
      });
    }
    if (pendingInvites > 8) {
      alerts.push({
        id: 'invites',
        title: 'Invite backlog is building up',
        detail: `${pendingInvites} recent invites have not been used yet.`,
        tone: 'warning',
      });
    }
    if (interventionsLast7.length === 0 && athletes.length > 0) {
      alerts.push({
        id: 'activity',
        title: 'No activity logged this week',
        detail: 'No intervention records were created in the last 7 days.',
        tone: 'critical',
      });
    }
    if (staleStravaConnections > 0) {
      alerts.push({
        id: 'strava_sync',
        title: 'Some Strava connections need attention',
        detail: `${staleStravaConnections} connected account(s) have never synced recently or show a sync error state.`,
        tone: 'warning',
      });
    }
    if (!alerts.length) {
      alerts.push({
        id: 'healthy',
        title: 'No urgent operator issues detected',
        detail: 'Core admin metrics are within a normal range for the latest 30-day window.',
        tone: 'positive',
      });
    }

    res.status(200).json({
      generatedAt: new Date().toISOString(),
      operator: {
        athleteId: adminContext.athlete.id,
        email: adminContext.athlete.email || null,
        name: adminContext.athlete.name || null,
      },
      metrics: {
        totalAthletes: athletes.length,
        activeAthletes7d: activeAthleteIds7.size,
        newAthletes7d: newAthletes7.length,
        newAthletes30d: newAthletes30.length,
        onboardedCount,
        paidCount: paidAthletes.length,
        adminCount,
        interventionCount7d: interventionsLast7.length,
        interventionCount30d: interventionsLast30.length,
        coachCount: coachProfilesResponse.count || 0,
        activeCoachLinks: coachLinksResponse.count || 0,
        publishedResearchCount: researchResponse.count || 0,
        inviteConversionRate,
        pendingInvites,
        connectedStravaAccounts: stravaAccountsResponse.count || 0,
        syncedAthletes30d: syncedAthleteIds30.size,
        stravaActivities30d: stravaActivitiesLast30.length,
        totalStravaActivities: stravaActivitiesTotalResponse.count || 0,
      },
      planBreakdown: [
        { key: 'free', label: 'Free', count: planBreakdown.free || 0 },
        { key: 'research', label: 'Research', count: planBreakdown.research || 0 },
        { key: 'individual', label: 'Individual', count: planBreakdown.individual || 0 },
        { key: 'coach', label: 'Coach', count: planBreakdown.coach || 0 },
      ],
      topInterventionTypes,
      alerts,
      recentSignups,
      recentActivity: recentActivity.map((item) => ({
        id: item.id,
        athlete_id: item.athlete_id,
        athlete_name: item.athletes?.name || 'Unknown athlete',
        intervention_type: item.intervention_type || 'Unknown',
        inserted_at: item.inserted_at,
      })),
      recentInvites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email || null,
        created_at: invite.created_at,
        used_at: invite.used_at,
      })),
    });
  } catch (error) {
    console.error('[admin/overview] failed:', error);
    res.status(500).json({ error: 'Could not load admin metrics.' });
  }
}
