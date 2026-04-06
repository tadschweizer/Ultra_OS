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

    // ── GET: own templates + shared templates from other coaches ────────────
    if (req.method === 'GET') {
      const [ownRes, sharedRes] = await Promise.all([
        supabase
          .from('protocol_templates')
          .select('id, name, protocol_type, description, instructions, duration_weeks, is_shared, created_at')
          .eq('coach_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('protocol_templates')
          .select('id, name, protocol_type, description, instructions, duration_weeks, is_shared, created_at')
          .eq('is_shared', true)
          .neq('coach_id', profile.id)
          .order('created_at', { ascending: false }),
      ]);

      if (ownRes.error) { res.status(500).json({ error: ownRes.error.message }); return; }

      res.status(200).json({
        templates: ownRes.data || [],
        sharedTemplates: sharedRes.data || [],
      });
      return;
    }

    // ── POST: create a template ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
      if (!body.protocol_type) { res.status(400).json({ error: 'protocol_type is required' }); return; }

      const { data, error } = await supabase
        .from('protocol_templates')
        .insert({
          coach_id: profile.id,
          name: body.name.trim(),
          protocol_type: body.protocol_type,
          description: body.description?.trim() || null,
          instructions: body.instructions || {},
          duration_weeks: body.duration_weeks || null,
          is_shared: body.is_shared === true,
        })
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ template: data });
      return;
    }

    // ── PUT: update own template ────────────────────────────────────────────
    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) { res.status(400).json({ error: 'id is required' }); return; }

      const updates = {};
      const updatable = ['name', 'protocol_type', 'description', 'instructions', 'duration_weeks', 'is_shared'];
      for (const key of updatable) {
        if (body[key] !== undefined) updates[key] = body[key];
      }

      const { data, error } = await supabase
        .from('protocol_templates')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ template: data });
      return;
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) { res.status(400).json({ error: 'id is required' }); return; }

      const { error } = await supabase
        .from('protocol_templates')
        .delete()
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
