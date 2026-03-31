import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';
import { inferLegacyScores, normalizeProtocolPayload } from '../../lib/interventionCatalog';
import { canLogIntervention, canLogCheckIn, FREE_INTERVENTION_LIMIT, FREE_WEEKLY_CHECKIN_LIMIT } from '../../lib/tierGates';

/**
 * API route to insert a new intervention into Supabase.
 *
 * Enforces free-tier limits:
 *   - Max 15 total interventions (all types) for free accounts
 *   - Max 3 Workout Check-ins per rolling 7-day window for free accounts
 *
 * Expects a JSON body with fields defined in the form. Requires
 * athlete_id from the cookie.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // ── Tier gate check ────────────────────────────────────────────────────────
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, subscription_tier')
    .eq('id', athleteId)
    .single();

  const tier = athlete?.subscription_tier || 'free';

  if (tier === 'free') {
    const body_type = req.body?.intervention_type;
    const isCheckIn = body_type === 'Workout Check-in';

    if (isCheckIn) {
      // Count check-ins in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: weeklyCheckIns } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .eq('athlete_id', athleteId)
        .eq('intervention_type', 'Workout Check-in')
        .gte('inserted_at', sevenDaysAgo.toISOString());

      const gate = canLogCheckIn(athlete, weeklyCheckIns ?? 0);
      if (!gate.allowed) {
        res.status(402).json({ error: gate.reason, upgradeRequired: true, limitType: 'weekly_checkin' });
        return;
      }
    } else {
      // Count all interventions (all time)
      const { count: totalCount } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .eq('athlete_id', athleteId);

      const gate = canLogIntervention(athlete, totalCount ?? 0);
      if (!gate.allowed) {
        res.status(402).json({ error: gate.reason, upgradeRequired: true, limitType: 'total_interventions' });
        return;
      }
    }
  }
  // ── End tier gate ──────────────────────────────────────────────────────────

  const body = req.body;
  try {
    const protocolPayload = normalizeProtocolPayload(body.intervention_type, body.protocol_payload || {});
    const legacyFields = inferLegacyScores(body.intervention_type, protocolPayload);
    const { error } = await supabase.from('interventions').insert({
      athlete_id: athleteId,
      race_id: body.race_id || null,
      activity_id: body.activity_id || null,
      date: body.date || null,
      intervention_type: body.intervention_type || null,
      details: body.details || legacyFields.details,
      dose_duration: body.dose_duration || legacyFields.dose_duration,
      timing: body.timing || legacyFields.timing,
      protocol_payload: protocolPayload,
      gi_response: body.gi_response ? parseInt(body.gi_response, 10) : legacyFields.gi_response,
      physical_response: body.physical_response ? parseInt(body.physical_response, 10) : legacyFields.physical_response,
      subjective_feel: body.subjective_feel ? parseInt(body.subjective_feel, 10) : legacyFields.subjective_feel,
      training_phase: body.training_phase || null,
      target_race: body.target_race || null,
      target_race_date: body.target_race_date || null,
      notes: body.notes || null,
    });
    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
