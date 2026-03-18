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
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();
  // Count interventions
  const { data: interventionsList } = await supabase
    .from('interventions')
    .select('id')
    .eq('athlete_id', athleteId);
  const count = interventionsList ? interventionsList.length : 0;
  res.status(200).json({ athlete, interventionCount: count });
}
