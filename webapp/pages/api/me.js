import { getSupabaseAdminClient } from '../../lib/authServer';
import { buildUsageSnapshot, getSubscriptionTierLabel, normalizeSubscriptionTier } from '../../lib/subscriptionTiers';
import { buildLoadMetrics, buildLoadStatus } from '../../lib/loadRollups';
import { clearAthleteCookie, renewAthleteCookieIfStale } from '../../lib/auth/sessionCookies.js';
import { resolveEffectiveAthleteId } from '../../lib/auth/requireAthlete.js';
import { isValidAthleteId } from '../../lib/auth/contracts.js';

/**
 * Returns the authenticated athlete profile plus subscription tier and usage.
 * Admin impersonation: reports the TARGET athlete's profile with an
 * `impersonating` block so the client can show the read-only banner.
 */
export default async function handler(req, res) {
  const admin = getSupabaseAdminClient();
  const { athleteId, isImpersonating, session } = await resolveEffectiveAthleteId(req, admin);

  if (!athleteId) {
    // Covers an expired token and one revoked by a password change or
    // "sign out everywhere". Clearing the cookie here is what turns a revoked
    // session into a visibly logged-out browser on the next page load.
    clearAthleteCookie(res);
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!isValidAthleteId(athleteId)) {
    clearAthleteCookie(res);
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Every page load calls this endpoint, so it is the natural place to slide
  // the expiry forward and keep active users signed in.
  if (!isImpersonating) renewAthleteCookieIfStale(res, session);

  // Fetch athlete
  const { data: athlete, error: athleteError } = await admin
    .from('athletes')
    .select('id, name, email, strava_id, token_expires_at, onboarding_complete, primary_sports, years_racing_band, weekly_training_hours_band, home_elevation_ft, target_race_id, is_admin, subscription_tier, supabase_user_id, stripe_subscription_status, email_verified_at')
    .eq('id', athleteId)
    .maybeSingle();
  if (athleteError) {
    console.error(athleteError);
    res.status(500).json({ error: athleteError.message });
    return;
  }
  if (!athlete) {
    clearAthleteCookie(res);
    res.status(401).json({ error: 'Not authenticated' });
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


  const [interventionLoadRes, activityLoadRes] = await Promise.all([
    admin
      .from('interventions')
      .select('date, inserted_at, dose_duration, subjective_feel')
      .eq('athlete_id', athleteId)
      .gte('inserted_at', new Date(Date.now() - 42 * 86400000).toISOString()),
    admin
      .from('strava_activities')
      .select('*')
      .eq('athlete_id', athleteId)
      .gte('start_date', new Date(Date.now() - 42 * 86400000).toISOString()),
  ]);

  const loadMetrics = buildLoadMetrics({
    interventions: interventionLoadRes.data || [],
    activities: activityLoadRes.data || [],
    lookbackDays: 42,
  });
  const loadStatus = buildLoadStatus(loadMetrics);

  const normalizedTier = normalizeSubscriptionTier(athlete.subscription_tier);
  const normalizedAthlete = {
    ...athlete,
    subscription_tier: normalizedTier,
    subscription_label: getSubscriptionTierLabel(normalizedTier),
    auth_provider: athlete.supabase_user_id ? 'supabase' : athlete.strava_id ? 'strava' : null,
    // Strava-only accounts never go through Supabase email confirmation, so
    // they are not "unverified" in a way the user can act on — only accounts
    // with a Supabase identity can be prompted to confirm.
    email_verified: Boolean(athlete.email_verified_at) || !athlete.supabase_user_id,
  };

  res.status(200).json({
    athlete: normalizedAthlete,
    impersonating: isImpersonating ? { athleteId: athlete.id, name: athlete.name } : null,
    interventionCount: count ?? 0,
    weeklyCheckIns: weeklyCheckIns ?? 0,
    load_metrics: loadMetrics,
    load_status: loadStatus,
    usage: buildUsageSnapshot({
      athlete: normalizedAthlete,
      interventionCount: count ?? 0,
      weeklyCheckIns: weeklyCheckIns ?? 0,
    }),
  });
}
