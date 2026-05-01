import cookie from 'cookie';
import { supabase } from '../../lib/supabaseClient';

function getAthleteId(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return cookies.athlete_id;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method === 'GET') {
    const { data: links, error } = await supabase
      .from('coach_athlete_links')
      .select('id, athlete_id, coach_id, role, status, created_at')
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const coachIds = (links || []).map((item) => item.coach_id);
    const { data: profiles } = coachIds.length
      ? await supabase
          .from('coach_profiles')
          .select('id, display_name, coach_code, created_at')
          .in('id', coachIds)
      : { data: [] };

    res.status(200).json({
      connections: (links || []).map((link) => ({
        ...link,
        coach: (profiles || []).find((profile) => profile.id === link.coach_id) || null,
      })),
    });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const role = body.role === 'secondary' ? 'secondary' : 'primary';
    const coachCode = body.coach_code?.trim().toUpperCase();

    if (!coachCode) {
      res.status(400).json({ error: 'coach_code is required' });
      return;
    }

    const { data: coachProfile, error: coachError } = await supabase
      .from('coach_profiles')
      .select('id, display_name, coach_code')
      .eq('coach_code', coachCode)
      .single();

    if (coachError || !coachProfile) {
      res.status(404).json({ error: 'Coach code not found' });
      return;
    }

    const { data: existingRole } = await supabase
      .from('coach_athlete_links')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('role', role)
      .eq('status', 'active')
      .maybeSingle();

    if (existingRole) {
      res.status(400).json({ error: `An active ${role} coach is already connected` });
      return;
    }

    const { data: link, error } = await supabase
      .from('coach_athlete_links')
      .insert({
        athlete_id: athleteId,
        coach_id: coachProfile.id,
        role,
        status: 'active',
      })
      .select('id, athlete_id, coach_id, role, status, created_at')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ connection: { ...link, coach: coachProfile } });
    return;
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const { error } = await supabase
      .from('coach_athlete_links')
      .update({ status: 'inactive' })
      .eq('id', id)
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
