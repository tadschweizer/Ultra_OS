import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';

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
      source: ['catalog', 'web', 'manual'].includes(body.source) ? body.source : 'manual',
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
