import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';
import { buildUsageSnapshot, getSubscriptionTierLabel, normalizeSubscriptionTier } from '../../lib/subscriptionTiers';
import { buildLoadMetrics, buildLoadStatus } from '../../lib/loadRollups';

/**
 * Returns the authenticated athlete profile plus subscription tier and usage.
 */
export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
  const clearCookie = () => {
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('athlete_id', '', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
    );
  };

  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!isUuid(athleteId)) {
    clearCookie();
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  // Fetch athlete
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('id, name, email, strava_id, onboarding_complete, primary_sports, years_racing_band, weekly_training_hours_band, home_elevation_ft, target_race_id, is_admin, subscription_tier, supabase_user_id, stripe_subscription_status')
    .eq('id', athleteId)
    .maybeSingle();
  if (athleteError) {
    console.error(athleteError);
    res.status(500).json({ error: athleteError.message });
    return;
  }
  if (!athlete) {
    clearCookie();
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { count, error: interventionsError } = await supabase
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

  const { count: weeklyCheckIns, error: weeklyError } = await supabase
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
    supabase
      .from('interventions')
      .select('date, inserted_at, dose_duration, subjective_feel')
      .eq('athlete_id', athleteId)
      .gte('inserted_at', new Date(Date.now() - 42 * 86400000).toISOString()),
    supabase
      .from('activities')
      .select('start_date, moving_time, perceived_exertion')
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
  };

  res.status(200).json({
    athlete: normalizedAthlete,
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
