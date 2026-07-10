import { createClient } from '@supabase/supabase-js';
import { requireAdminAthleteId } from '../../../lib/auth/requireAthlete.js';

/**
 * GET /api/admin/recent-logs
 *
 * Returns the last N interventions across ALL athletes, with athlete name.
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

  const supabase = getAdminClient();
  const athleteId = await requireAdminAthleteId(req, res, supabase);
  if (!athleteId) return;

  const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);

  const { data: logs, error } = await supabase
    .from('interventions')
    .select('id, intervention_type, logged_at:inserted_at, athlete_id, athletes(name)')
    .order('inserted_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ logs: logs || [] });
}
