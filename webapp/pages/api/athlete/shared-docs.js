import { getSupabaseAdminClient } from '../../../lib/authServer.js';
import { getEffectiveAthleteIdFromRequest } from '../../../lib/auth/requireAthlete.js';

// Server-side routes cannot use the anon client: it carries no Supabase
// session, so auth.uid() is null and every RLS policy denies it. This route
// uses the service-role client and authorises from the session athlete id.
export function createAthleteSharedDocsHandler({ getClient = getSupabaseAdminClient } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const supabase = getClient();
      const athleteId = await getEffectiveAthleteIdFromRequest(req, supabase);
      if (!athleteId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      if (req.method !== 'GET') {
        res.status(405).end();
        return;
      }

      const { data: relationships, error: relationshipError } = await supabase
        .from('coach_athlete_relationships').select('coach_id')
        .eq('athlete_id', athleteId).eq('status', 'active');
      if (relationshipError) throw relationshipError;
      const coaches = [...new Set((relationships || []).map(row => row.coach_id))];
      if (!coaches.length) return res.status(200).json({ docs: [] });

      const { data, error } = await supabase
        .from('coach_shared_docs')
        .select('id, title, category, doc_type, content, resource_url, sort_order, created_at, coach_id')
        .eq('athlete_id', athleteId)
        .in('coach_id', coaches)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        res.status(503).json({ error: 'Documents could not be loaded. Please retry.' });
        return;
      }

      res.status(200).json({ docs: data || [] });
    } catch {
      res.status(503).json({ error: 'Documents could not be loaded. Please retry.' });
    }
  };
}
export default createAthleteSharedDocsHandler();
