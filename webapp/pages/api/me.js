import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';

/**
 * API route to return basic athlete info and intervention count.
 *
 * Uses the athlete_id cookie to query Supabase. Returns the
 * athlete's name and the number of logged interventions.
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
    .select('id, name, email, strava_id, onboarding_complete, primary_sports, years_racing_band, weekly_training_hours_band, home_elevation_ft, target_race_id, is_admin')
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
  res.status(200).json({ athlete, interventionCount: count });
}
