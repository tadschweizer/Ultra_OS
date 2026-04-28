import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../lib/authServer';
import { archiveWorkoutUploadNotification } from '../../lib/notificationServer';
import { buildInterventionInsertPayload } from '../../lib/protocolAssignmentServer';
import { completeActivityFollowUpPrompts } from '../../lib/providerEvents';
import { canLogCheckIn, canLogIntervention, normalizeSubscriptionTier } from '../../lib/subscriptionTiers';


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
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const body = req.body;
  const admin = getSupabaseAdminClient();
  try {
    const { data: athlete, error: athleteError } = await admin
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

    const { count: interventionCount, error: interventionCountError } = await admin
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
      const { count: weeklyCheckIns, error: weeklyError } = await admin
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

    const payload = await buildInterventionInsertPayload({ admin, athleteId, body });
    const { error } = await admin.from('interventions').insert(payload);
    if (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
      return;
    }

    if (body.intervention_type === 'Workout Check-in' && body.activity_id) {
      await archiveWorkoutUploadNotification(admin, athleteId, body.activity_id);
    }

    if (body.activity_id && body.activity_provider) {
      await completeActivityFollowUpPrompts(admin, {
        athleteId,
        provider: body.activity_provider,
        providerActivityId: body.activity_id,
        interventionType: body.intervention_type,
      });
    }

    res.status(200).json({ success: true, subscriptionTier: athlete.subscription_tier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
