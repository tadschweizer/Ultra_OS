import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';
import { buildUsageSnapshot, getSubscriptionTierLabel, normalizeSubscriptionTier } from '../../lib/subscriptionTiers';

export const runtime = 'edge';

/**
 * Returns the authenticated athlete profile plus subscription tier and usage.
 */
export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  // Fetch athlete
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('id, name, email, strava_id, onboarding_complete, primary_sports, years_racing_band, weekly_training_hours_band, home_elevation_ft, target_race_id, is_admin, subscription_tier, supabase_user_id, stripe_subscription_status')
    .eq('id', athleteId)
    .single();
  if (athleteError) {
    console.error(athleteError);
    res.status(500).json({ error: athleteError.message });
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
    usage: buildUsageSnapshot({
      athlete: normalizedAthlete,
      interventionCount: count ?? 0,
      weeklyCheckIns: weeklyCheckIns ?? 0,
    }),
  });
}
