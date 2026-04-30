import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';

export const runtime = 'edge';

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const { data, error } = await supabase
    .from('coach_shared_docs')
    .select('id, title, category, doc_type, content, resource_url, sort_order, created_at, coach_id')
    .eq('athlete_id', athleteId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ docs: data || [] });
}
