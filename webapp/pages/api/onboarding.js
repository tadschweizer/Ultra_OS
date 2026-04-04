import cookie from 'cookie';
import { supabase } from '../../lib/supabaseClient';
import { deriveRaceType } from '../../lib/raceTypes';

export const runtime = 'edge';

function parseOptionalFloat(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getAthleteId(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return cookies.athlete_id;
}

async function loadCurrentTargetRace(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('target_race_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (!athlete?.target_race_id) {
    return null;
  }

  const { data: race } = await supabase
    .from('races')
    .select('id, name, event_date, race_type, distance_miles, location')
    .eq('id', athlete.target_race_id)
    .maybeSingle();

  return race || null;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method === 'GET') {
    const { data: athlete, error } = await supabase
      .from('athletes')
      .select('id, name, email, onboarding_complete, primary_sports, years_racing_band, weekly_training_hours_band, home_elevation_ft, target_race_id')
      .eq('id', athleteId)
      .single();

    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }

    const targetRace = await loadCurrentTargetRace(athleteId);
    res.status(200).json({ athlete, targetRace });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const sports = Array.isArray(body.primary_sports)
      ? body.primary_sports.map((item) => String(item).trim()).filter(Boolean)
      : [];

    let targetRaceId = body.target_race_id || null;

    if (body.target_race && !targetRaceId) {
      const racePayload = {
        athlete_id: athleteId,
        name: body.target_race.name?.trim(),
        event_date: body.target_race.event_date || null,
        race_type:
          body.target_race.race_type?.trim() ||
          deriveRaceType(body.target_race.distance_miles, body.target_race.surface) ||
          null,
        distance_miles: parseOptionalFloat(body.target_race.distance_miles),
        elevation_gain_ft: null,
        location: body.target_race.location?.trim() || null,
        surface: body.target_race.surface?.trim() || null,
        notes: null,
      };

      if (!racePayload.name || !racePayload.event_date || !racePayload.distance_miles || !racePayload.location) {
        res.status(400).json({ error: 'Manual race entry requires name, date, distance, and location.' });
        return;
      }

      const { data: insertedRace, error: raceError } = await supabase
        .from('races')
        .insert(racePayload)
        .select('id')
        .single();

      if (raceError) {
        console.error(raceError);
        res.status(500).json({ error: raceError.message });
        return;
      }

      targetRaceId = insertedRace.id;
    }

    const { data: athlete, error } = await supabase
      .from('athletes')
      .update({
        onboarding_complete: Boolean(body.onboarding_complete),
        primary_sports: sports,
        years_racing_band: body.years_racing_band || null,
        weekly_training_hours_band: body.weekly_training_hours_band || null,
        home_elevation_ft: parseOptionalInt(body.home_elevation_ft),
        target_race_id: targetRaceId,
      })
      .eq('id', athleteId)
      .select('id, name, onboarding_complete, primary_sports, years_racing_band, weekly_training_hours_band, home_elevation_ft, target_race_id')
      .single();

    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }

    const targetRace = targetRaceId ? await loadCurrentTargetRace(athleteId) : null;
    res.status(200).json({ athlete, targetRace });
    return;
  }

  res.status(405).end();
}
