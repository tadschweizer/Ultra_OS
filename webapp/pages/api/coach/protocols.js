import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { generateCoachCode } from '../../../lib/coachProtocols';

export const runtime = 'edge';

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();

  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('coach_profiles')
    .insert({
      athlete_id: athleteId,
      display_name: athlete?.name || 'Coach',
      coach_code: generateCoachCode(athlete?.name || 'Coach'),
    })
    .select('id, athlete_id, display_name, coach_code')
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

    // ── GET: list protocols, optionally filtered by athlete_id ──────────────
    if (req.method === 'GET') {
      let query = supabase
        .from('assigned_protocols')
        .select(`
          id, athlete_id, protocol_name, protocol_type, description,
          instructions, target_race_id, start_date, end_date,
          status, compliance_target, created_at, updated_at,
          races(id, name, event_date, race_type)
        `)
        .eq('coach_id', profile.id)
        .order('start_date', { ascending: false });

      if (typeof req.query.athlete_id === 'string') {
        query = query.eq('athlete_id', req.query.athlete_id);
      }
      if (typeof req.query.status === 'string') {
        query = query.eq('status', req.query.status);
      }

      const { data, error } = await query;
      if (error) { res.status(500).json({ error: error.message }); return; }

      // Attach athlete names
      const ids = [...new Set((data || []).map((p) => p.athlete_id))];
      const { data: athletes } = ids.length
        ? await supabase.from('athletes').select('id, name').in('id', ids)
        : { data: [] };

      const protocols = (data || []).map((p) => ({
        ...p,
        athlete: (athletes || []).find((a) => a.id === p.athlete_id) || null,
      }));

      res.status(200).json({ protocols, profile });
      return;
    }

    // ── POST: assign a new protocol ─────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const required = ['athlete_id', 'protocol_name', 'protocol_type', 'start_date', 'end_date'];
      const missing = required.filter((k) => !body[k]);
      if (missing.length) {
        res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
        return;
      }

      const { data, error } = await supabase
        .from('assigned_protocols')
        .insert({
          coach_id: profile.id,
          athlete_id: body.athlete_id,
          protocol_name: body.protocol_name.trim(),
          protocol_type: body.protocol_type,
          description: body.description?.trim() || null,
          instructions: body.instructions || {},
          target_race_id: body.target_race_id || null,
          start_date: body.start_date,
          end_date: body.end_date,
          status: body.status || 'assigned',
          compliance_target: body.compliance_target ?? 80,
        })
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ protocol: data, profile });
      return;
    }

    // ── PUT: update an existing protocol ────────────────────────────────────
    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) { res.status(400).json({ error: 'id is required' }); return; }

      const updates = {};
      const updatable = [
        'protocol_name', 'protocol_type', 'description', 'instructions',
        'target_race_id', 'start_date', 'end_date', 'status', 'compliance_target',
      ];
      for (const key of updatable) {
        if (body[key] !== undefined) updates[key] = body[key];
      }

      const { data, error } = await supabase
        .from('assigned_protocols')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ protocol: data });
      return;
    }

    // ── DELETE: abandon a protocol ───────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) { res.status(400).json({ error: 'id is required' }); return; }

      const { error } = await supabase
        .from('assigned_protocols')
        .update({ status: 'abandoned' })
        .eq('id', id)
        .eq('coach_id', profile.id);

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
