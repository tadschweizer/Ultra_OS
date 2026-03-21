import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';

function parseOptionalInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
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
    const { data, error } = await supabase
      .from('athlete_settings')
      .select('*')
      .eq('athlete_id', athleteId)
      .maybeSingle();

    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ settings: data || null });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    const payload = {
      athlete_id: athleteId,
      baseline_sleep_altitude_ft: parseOptionalInt(body.baseline_sleep_altitude_ft),
      baseline_training_altitude_ft: parseOptionalInt(body.baseline_training_altitude_ft),
      resting_hr: parseOptionalInt(body.resting_hr),
      max_hr: parseOptionalInt(body.max_hr),
      hr_zone_1_min: parseOptionalInt(body.hr_zone_1_min),
      hr_zone_1_max: parseOptionalInt(body.hr_zone_1_max),
      hr_zone_2_min: parseOptionalInt(body.hr_zone_2_min),
      hr_zone_2_max: parseOptionalInt(body.hr_zone_2_max),
      hr_zone_3_min: parseOptionalInt(body.hr_zone_3_min),
      hr_zone_3_max: parseOptionalInt(body.hr_zone_3_max),
      hr_zone_4_min: parseOptionalInt(body.hr_zone_4_min),
      hr_zone_4_max: parseOptionalInt(body.hr_zone_4_max),
      hr_zone_5_min: parseOptionalInt(body.hr_zone_5_min),
      hr_zone_5_max: parseOptionalInt(body.hr_zone_5_max),
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('athlete_settings')
      .upsert(payload, { onConflict: 'athlete_id' })
      .select('*')
      .single();

    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ settings: data });
    return;
  }

  res.status(405).end();
}
