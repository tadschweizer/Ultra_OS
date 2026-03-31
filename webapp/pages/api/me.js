import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';

/**
 * GET /api/me
 *
 * Returns the authenticated athlete's profile, subscription tier,
 * and current usage counts (used by the frontend for tier gates and UI).
 */
export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Fetch athlete (now includes subscription_tier)
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('id, name, email, strava_id, onboarding_complete, primary_sports, years_racing_band, weekly_training_hours_band, home_elevation_ft, target_race_id, is_admin, subscription_tier')
    .eq('id', athleteId)
    .single();

  if (athleteError) {
    console.error(athleteError);
    res.status(500).json({ error: athleteError.message });
    return;
  }

  // Total intervention count (all types, all time)
  const { count: interventionCount, error: interventionsError } = await supabase
    .from('interventions')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', athleteId);

  if (interventionsError) {
    console.error(interventionsError);
    res.status(500).json({ error: interventionsError.message });
    return;
  }

  // Weekly check-in count (Workout Check-in type, last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { count: weeklyCheckIns } = await supabase
    .from('interventions')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', athleteId)
    .eq('intervention_type', 'Workout Check-in')
    .gte('inserted_at', sevenDaysAgo.toISOString());

  const tier = athlete.subscription_tier || 'free';

  // Free tier limits (keep in sync with lib/tierGates.js)
  const FREE_INTERVENTION_LIMIT = 15;
  const FREE_WEEKLY_CHECKIN_LIMIT = 3;

  res.status(200).json({
    athlete: { ...athlete, subscription_tier: tier },
    interventionCount: interventionCount ?? 0,
    weeklyCheckIns: weeklyCheckIns ?? 0,
    usage: {
      interventionsUsed: interventionCount ?? 0,
      interventionsLimit: tier === 'free' ? FREE_INTERVENTION_LIMIT : null,
      weeklyCheckInsUsed: weeklyCheckIns ?? 0,
      weeklyCheckInsLimit: tier === 'free' ? FREE_WEEKLY_CHECKIN_LIMIT : null,
      atInterventionLimit: tier === 'free' && (interventionCount ?? 0) >= FREE_INTERVENTION_LIMIT,
      atCheckInLimit: tier === 'free' && (weeklyCheckIns ?? 0) >= FREE_WEEKLY_CHECKIN_LIMIT,
    },
  });
}
