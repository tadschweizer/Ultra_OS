import { supabase } from '../../lib/supabaseClient';

export const runtime = 'edge';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const sportType = typeof req.query.sport_type === 'string' ? req.query.sport_type.trim() : '';

  let request = supabase
    .from('race_catalog')
    .select('id, name, event_date, city, state, country, distance_miles, sport_type')
    .order('event_date', { ascending: true, nullsFirst: false })
    .limit(query ? 10 : 20);

  if (query) {
    request = request.ilike('name', `%${query}%`);
  }

  if (sportType) {
    request = request.eq('sport_type', sportType);
  }

  const { data, error } = await request;

  if (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ races: data || [] });
}
