import { getSupabaseAdminClient } from '../../../lib/authServer';
import { getAthleteIdFromRequest } from '../../../lib/auth/sessionCookies.js';

// Server-side routes cannot use the anon client: it carries no Supabase
// session, so auth.uid() is null and every RLS policy denies it. This route
// uses the service-role client and authorises from the session athlete id.
const supabase = getSupabaseAdminClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const athleteId = getAthleteIdFromRequest(req);

  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('id, is_admin')
    .eq('id', athleteId)
    .single();

  if (athleteError || !athlete?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const { data, error } = await supabase
    .from('integration_interest')
    .select('id, athlete_id, email, source_name, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load integration interest records.' });
    return;
  }

  res.status(200).json({
    records: data || [],
  });
}
