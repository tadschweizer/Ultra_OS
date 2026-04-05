import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';

export const runtime = 'edge';

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
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('race_outcomes')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('race_date', { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ outcomes: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    if (!body.race_name?.trim()) {
      return res.status(400).json({ error: 'Race name is required' });
    }

    const payload = {
      athlete_id: athleteId,
      race_name: body.race_name.trim(),
      race_date: body.race_date || null,
      race_type: body.race_type || null,
      finish_outcome: body.finish_outcome || null,
      finish_time_minutes: parseOptionalInt(body.finish_time_minutes),
      goal_time_minutes: parseOptionalInt(body.goal_time_minutes),
      overall_rating: parseOptionalInt(body.overall_rating),
      gi_distress_score: parseOptionalInt(body.gi_distress_score),
      energy_management: body.energy_management || null,
      pacing_strategy: body.pacing_strategy || null,
      peak_hr_bpm: parseOptionalInt(body.peak_hr_bpm),
      avg_hr_bpm: parseOptionalInt(body.avg_hr_bpm),
      avg_carbs_g_per_hr: parseOptionalFloat(body.avg_carbs_g_per_hr),
      total_fluid_l: parseOptionalFloat(body.total_fluid_l),
      heat_impact: body.heat_impact || null,
      what_worked: body.what_worked || null,
      what_to_change: body.what_to_change || null,
      would_use_again: body.would_use_again || null,
      notes: body.notes || null,
    };

    const { data, error } = await supabase
      .from('race_outcomes')
      .insert(payload)
      .select('id, race_name, race_date')
      .single();

    if (error) {
      console.error(error);
      // If table doesn't exist yet, return a helpful error without crashing
      if (error.code === '42P01') {
        return res.status(503).json({ error: 'race_outcomes table not yet created. Run the migration.' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ outcome: data });
  }

  return res.status(405).end();
}
