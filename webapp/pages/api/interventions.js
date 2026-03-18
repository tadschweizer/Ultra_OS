import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';

/**
 * API route to fetch all interventions for the logged in athlete.
 */
export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { data, error } = await supabase
    .from('interventions')
    .select('id, date, intervention_type, gi_response, physical_response, subjective_feel, activity_id')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ interventions: data || [] });
}
