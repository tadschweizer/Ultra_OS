import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';
import { deriveRaceType } from '../../lib/raceTypes';

function parseOptionalInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalFloat(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;

  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method === 'GET') {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    let request = supabase
      .from('races')
      .select('id, name, event_date, race_type, distance_miles, elevation_gain_ft, location, surface, notes')
      .eq('athlete_id', athleteId)
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(query ? 8 : 12);

    if (query) {
      request = request.ilike('name', `%${query}%`);
    }

    const { data, error } = await request;

    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({
      races: (data || []).map((race) => ({
        ...race,
        race_type: race.race_type || deriveRaceType(race.distance_miles, race.surface),
      })),
    });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    if (!body.name?.trim()) {
      res.status(400).json({ error: 'Race name is required' });
      return;
    }

    const payload = {
      athlete_id: athleteId,
      name: body.name.trim(),
      event_date: body.event_date || null,
      race_type: body.race_type?.trim() || deriveRaceType(body.distance_miles, body.surface) || null,
      distance_miles: parseOptionalFloat(body.distance_miles),
      elevation_gain_ft: parseOptionalInt(body.elevation_gain_ft),
      location: body.location?.trim() || null,
      surface: body.surface?.trim() || null,
      notes: body.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from('races')
      .insert(payload)
      .select('id, name, event_date, race_type, distance_miles, elevation_gain_ft, location, surface, notes')
      .single();

    if (error) {
      const isStackDepthError = /stack depth limit exceeded/i.test(error.message || '');
      if (isStackDepthError) {
        const { error: athleteError } = await supabase
          .from('athletes')
          .update({
            target_race: payload.name,
            target_race_date: payload.event_date,
            target_race_id: null,
          })
          .eq('id', athleteId);

        if (athleteError) {
          console.error(athleteError);
          res.status(500).json({ error: athleteError.message });
          return;
        }

        res.status(200).json({
          race: {
            id: null,
            name: payload.name,
            event_date: payload.event_date,
            race_type: payload.race_type,
            distance_miles: payload.distance_miles,
            elevation_gain_ft: payload.elevation_gain_ft,
            location: payload.location,
            surface: payload.surface,
            notes: payload.notes,
            fallback_saved: true,
          },
        });
        return;
      }

      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ race: data });
    return;
  }

  res.status(405).end();
}
