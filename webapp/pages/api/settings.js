import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../lib/authServer';


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
  const athleteId = getAthleteIdFromRequest(req);
  const supabase = getSupabaseAdminClient();

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

    const { data: supplements, error: supplementsError } = await supabase
      .from('athlete_supplements')
      .select('id, supplement_name, amount, unit, frequency_per_day')
      .eq('athlete_id', athleteId)
      .order('inserted_at', { ascending: true });

    if (error || supplementsError) {
      console.error(error || supplementsError);
      res.status(500).json({ error: error?.message || supplementsError?.message });
      return;
    }

    res.status(200).json({ settings: data || null, supplements: supplements || [] });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const supplements = Array.isArray(body.supplements)
      ? body.supplements
          .map((item) => ({
            supplement_name: item?.supplement_name?.trim() || '',
            amount: item?.amount === '' || item?.amount === null || item?.amount === undefined ? null : parseOptionalFloat(item.amount),
            unit: item?.unit?.trim() || 'mg',
            frequency_per_day:
              item?.frequency_per_day === '' || item?.frequency_per_day === null || item?.frequency_per_day === undefined
                ? 1
                : parseOptionalInt(item.frequency_per_day),
          }))
          .filter((item) => item.supplement_name || item.amount)
      : [];

    const payload = {
      athlete_id: athleteId,
      baseline_sleep_altitude_ft: parseOptionalInt(body.baseline_sleep_altitude_ft),
      baseline_training_altitude_ft: parseOptionalInt(body.baseline_training_altitude_ft),
      resting_hr: parseOptionalInt(body.resting_hr),
      max_hr: parseOptionalInt(body.max_hr),
      body_weight_lb: parseOptionalInt(body.body_weight_lb),
      normal_long_run_carb_g_per_hr: parseOptionalInt(body.normal_long_run_carb_g_per_hr),
      sweat_rate_l_per_hr: parseOptionalFloat(body.sweat_rate_l_per_hr),
      sweat_sodium_concentration_mg_l: parseOptionalInt(body.sweat_sodium_concentration_mg_l),
      sodium_target_mg_per_hr: parseOptionalInt(body.sodium_target_mg_per_hr),
      fluid_target_ml_per_hr: parseOptionalInt(body.fluid_target_ml_per_hr),
      typical_sleep_hours: parseOptionalFloat(body.typical_sleep_hours),
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

    const { error: deleteSupplementsError } = await supabase
      .from('athlete_supplements')
      .delete()
      .eq('athlete_id', athleteId);

    if (deleteSupplementsError) {
      console.error(deleteSupplementsError);
      res.status(500).json({ error: deleteSupplementsError.message });
      return;
    }

    if (supplements.length > 0) {
      const { data: savedSupplements, error: supplementsError } = await supabase
        .from('athlete_supplements')
        .insert(
          supplements.map((item) => ({
            athlete_id: athleteId,
            supplement_name: item.supplement_name,
            amount: item.amount,
            unit: item.unit || 'mg',
            frequency_per_day: item.frequency_per_day || 1,
          }))
        )
        .select('id, supplement_name, amount, unit, frequency_per_day');

      if (supplementsError) {
        console.error(supplementsError);
        res.status(500).json({ error: supplementsError.message });
        return;
      }

      res.status(200).json({ settings: data, supplements: savedSupplements || [] });
      return;
    }

    res.status(200).json({ settings: data, supplements: [] });
    return;
  }

  res.status(405).end();
}
