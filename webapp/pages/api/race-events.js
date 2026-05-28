import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';

// Map a race_type string + optional distance to a catalog sport_type
function deriveSportType(raceType, distanceMiles) {
  const rt = (raceType || '').toLowerCase();
  if (rt.includes('triathlon') || rt === 'triathlon') return 'Long-Course Triathlon';
  if (rt === 'gravel') return 'Gravel Cycling';
  if (rt === 'marathon') return 'Marathon';
  if (rt === 'half marathon') return 'Half Marathon';
  if (rt === '10k') return '10K';
  if (rt === '3k / 5k' || rt === '5k') return '5K';
  if (rt === '1 mile / 1500m' || rt === 'mile') return 'Mile';
  if (rt === '50k+') {
    const d = parseFloat(distanceMiles);
    return !isNaN(d) && d >= 99 ? 'Ultrarunning' : 'Ultrarunning';
  }
  return 'Other Running';
}

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('race_events')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('event_date', { ascending: true, nullsFirst: false });
    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ events: data || [] });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name?.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const source = ['catalog', 'web', 'manual'].includes(body.source) ? body.source : 'manual';
    const payload = {
      athlete_id: athleteId,
      name: body.name.trim(),
      event_date: body.event_date || null,
      race_type: body.race_type || null,
      distance_miles: body.distance_miles ? parseFloat(body.distance_miles) : null,
      location: body.location?.trim() || null,
      priority: ['A', 'B', 'C'].includes(body.priority) ? body.priority : 'B',
      is_goal_race: body.is_goal_race === true,
      url: body.url?.trim() || null,
      notes: body.notes?.trim() || null,
      source,
      catalog_id: body.catalog_id || null,
    };
    const { data, error } = await supabase
      .from('race_events')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }

    // When a web-sourced race is saved, upsert it into race_catalog so future
    // searches hit the DB instead of calling Exa again.
    if (source === 'web' && payload.name) {
      const sportType = deriveSportType(payload.race_type, payload.distance_miles);
      const catalogEntry = {
        name: payload.name,
        event_date: payload.event_date || null,
        city: null,
        state: null,
        country: 'USA',
        distance_miles: payload.distance_miles || null,
        sport_type: sportType,
        url: payload.url || null,
        elevation_gain_ft: body.elevation_gain_ft ? parseInt(body.elevation_gain_ft, 10) : null,
        terrain: body.terrain || null,
      };
      // Best-effort upsert — don't block the response on failure
      supabase
        .from('race_catalog')
        .upsert(catalogEntry, { onConflict: 'name', ignoreDuplicates: false })
        .then(({ error: catalogErr }) => {
          if (catalogErr) console.error('catalog upsert error:', catalogErr.message);
        });
    }

    res.status(200).json({ event: data });
    return;
  }

  if (req.method === 'PATCH') {
    const id = typeof req.query.id === 'string' ? req.query.id.trim() : null;
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const body = req.body || {};
    const allowedFields = ['priority', 'is_goal_race', 'notes', 'event_date', 'race_type', 'distance_miles', 'location', 'name'];
    const updates = {};
    allowedFields.forEach((k) => {
      if (k in body) updates[k] = body[k];
    });
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No updatable fields provided' });
      return;
    }
    // When setting as goal race, clear the flag from all other events first
    if (updates.is_goal_race === true) {
      await supabase
        .from('race_events')
        .update({ is_goal_race: false })
        .eq('athlete_id', athleteId)
        .neq('id', id);
    }
    const { data, error } = await supabase
      .from('race_events')
      .update(updates)
      .eq('id', id)
      .eq('athlete_id', athleteId)
      .select('*')
      .single();
    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ event: data });
    return;
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id.trim() : null;
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const { error } = await supabase
      .from('race_events')
      .delete()
      .eq('id', id)
      .eq('athlete_id', athleteId);
    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
}
