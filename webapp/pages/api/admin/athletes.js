import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';

/**
 * GET /api/admin/athletes
 *
 * Returns all athletes with their last activity date and intervention count.
 * Admin-only.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase service role config');
  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getAdminClient();

  // Check admin
  const { data: me } = await supabase
    .from('athletes')
    .select('is_admin')
    .eq('id', athleteId)
    .single();

  if (!me?.is_admin) return res.status(403).json({ error: 'Admin only' });

  // Fetch all athletes
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('id, name, email, strava_id, created_at, is_admin, onboarding_complete')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // For each athlete get intervention count and most recent intervention date
  const enriched = await Promise.all(
    athletes.map(async (a) => {
      const { count, data: latest } = await supabase
        .from('interventions')
        .select('logged_at', { count: 'exact' })
        .eq('athlete_id', a.id)
        .order('logged_at', { ascending: false })
        .limit(1);

      return {
        ...a,
        intervention_count: count || 0,
        last_intervention_at: latest?.[0]?.logged_at || null,
      };
    })
  );

  return res.status(200).json({ athletes: enriched });
}
