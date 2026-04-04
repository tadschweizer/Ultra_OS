import { supabase } from '../../lib/supabaseClient';
import cookie from 'cookie';
import { inferLegacyScores, normalizeProtocolPayload } from '../../lib/interventionCatalog';
import { canLogCheckIn, canLogIntervention, normalizeSubscriptionTier } from '../../lib/subscriptionTiers';

export const runtime = 'edge';

/**
 * API route to insert a new intervention into Supabase.
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
  const body = req.body;
  try {
    const { data: athlete, error: athleteError } = await supabase
      .from('athletes')
      .select('id, subscription_tier')
      .eq('id', athleteId)
      .single();

    if (athleteError) {
      console.error(athleteError);
      res.status(500).json({ error: athleteError.message });
      return;
    }

    athlete.subscription_tier = normalizeSubscriptionTier(athlete.subscription_tier);

    const { count: interventionCount, error: interventionCountError } = await supabase
      .from('interventions')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', athleteId);

    if (interventionCountError) {
      console.error(interventionCountError);
      res.status(500).json({ error: interventionCountError.message });
      return;
    }

    let gate = canLogIntervention(athlete, interventionCount ?? 0);
    if (body.intervention_type === 'Workout Check-in') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: weeklyCheckIns, error: weeklyError } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .eq('athlete_id', athleteId)
        .eq('intervention_type', 'Workout Check-in')
        .gte('inserted_at', sevenDaysAgo.toISOString());

      if (weeklyError) {
        console.error(weeklyError);
        res.status(500).json({ error: weeklyError.message });
        return;
      }

      gate = canLogCheckIn(athlete, weeklyCheckIns ?? 0);
    }

    if (!gate.allowed) {
      res.status(403).json({ error: gate.reason || 'Upgrade required.' });
      return;
    }

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
    res.status(200).json({ success: true, subscriptionTier: athlete.subscription_tier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
