import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../lib/authServer';
import { attachInterventionMessages } from '../../lib/messageServer';
import { buildInterventionInsertPayload } from '../../lib/protocolAssignmentServer';

const interventionSelect =
  'id, athlete_id, date, inserted_at, intervention_type, details, dose_duration, timing, protocol_payload, assigned_protocol_id, gi_response, physical_response, subjective_feel, activity_id, training_phase, target_race, target_race_date, race_id, notes, races(id, name, event_date, race_type, distance_miles, elevation_gain_ft, location, surface, notes)';

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  const admin = getSupabaseAdminClient();
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method === 'GET') {
    const { data: athlete, error: athleteError } = await admin
      .from('athletes')
      .select('id, name, email, supabase_user_id')
      .eq('id', athleteId)
      .maybeSingle();

    if (athleteError) {
      res.status(500).json({ error: athleteError.message });
      return;
    }

    const interventionId = typeof req.query.id === 'string' ? req.query.id : null;
    let query = admin
      .from('interventions')
      .select(interventionSelect)
      .eq('athlete_id', athleteId);

    if (interventionId) {
      const { data, error } = await query.eq('id', interventionId).single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const [intervention] = await attachInterventionMessages(admin, athlete, [data]);
      res.status(200).json({ intervention });
      return;
    }

    const { data, error } = await query
      .order('date', { ascending: false })
      .order('inserted_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const interventions = await attachInterventionMessages(admin, athlete, data || []);
    res.status(200).json({ interventions });
    return;
  }

  if (req.method === 'PUT') {
    const interventionId = req.body?.id;
    if (!interventionId) {
      res.status(400).json({ error: 'Intervention id is required' });
      return;
    }

    const payload = await buildInterventionInsertPayload({ admin, athleteId, body: req.body });
    delete payload.athlete_id;

    const { data, error } = await admin
      .from('interventions')
      .update(payload)
      .eq('id', interventionId)
      .eq('athlete_id', athleteId)
      .select(interventionSelect)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ intervention: data });
    return;
  }

  if (req.method === 'DELETE') {
    const interventionId = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
    if (!interventionId) {
      res.status(400).json({ error: 'Intervention id is required' });
      return;
    }

    const { error } = await admin
      .from('interventions')
      .delete()
      .eq('id', interventionId)
      .eq('athlete_id', athleteId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ success: true });
    return;
  }

  res.status(405).end();
}
