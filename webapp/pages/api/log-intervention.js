import { getSupabaseAdminClient } from '../../lib/authServer.js';
import { inferLegacyScores, normalizeProtocolPayload } from '../../lib/interventionCatalog.js';
import { canLogCheckIn, canLogIntervention, normalizeSubscriptionTier } from '../../lib/subscriptionTiers.js';
import { requireLiveAthleteId } from '../../lib/auth/requireAthlete.js';
import { loadCheckInEntitlement, EntitlementLookupError } from '../../lib/pilotEntitlementsServer.js';

// Server-side routes cannot use the anon client: it carries no Supabase
// session, so auth.uid() is null and every RLS policy denies it. This route
// uses the service-role client and authorises from the session athlete id.


/**
 * API route to insert a new intervention into Supabase.
 *
 * Expects a JSON body with fields defined in the form. Requires
 * athlete_id from the cookie.
 */
export function createLogInterventionHandler({ getClient = getSupabaseAdminClient, now = () => new Date() } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }
    const body = req.body || {};
    try {
      const supabase = getClient();
      const athleteId = await requireLiveAthleteId(req, res, supabase);
      if (!athleteId) return;
      const { data: athlete, error: athleteError } = await supabase
        .from('athletes')
        .select('id, subscription_tier, stripe_subscription_id, stripe_subscription_status')
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
        const { data: rateAllowed, error: rateError } = await supabase.rpc('consume_checkin_rate_limit', { target_athlete: athleteId });
        if (rateError || typeof rateAllowed !== 'boolean') throw new EntitlementLookupError();
        if (!rateAllowed) {
          res.setHeader('Retry-After', '60');
          return res.status(429).json({ error: 'Too many check-in submissions. Please wait a minute.' });
        }
        const entitlement = await loadCheckInEntitlement(supabase, athlete, now());
        const sevenDaysAgo = new Date(now());
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

        gate = canLogCheckIn(athlete, weeklyCheckIns ?? 0, entitlement);
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
      if (err instanceof EntitlementLookupError) return res.status(503).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
}

export default createLogInterventionHandler();
