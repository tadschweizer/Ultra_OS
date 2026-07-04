import { getSupabaseAdminClient } from '../../lib/authServer';
import { getAthleteIdFromRequest } from '../../lib/auth/sessionCookies.js';

const NOTE_COLUMNS = 'id, athlete_id, coach_id, note_date, title, body, visibility, note_type, created_at, updated_at';
const NOTE_TYPES = ['general', 'day_off', 'event', 'goal'];

async function getOwnCoachProfile(admin, sessionAthleteId) {
  const { data: profile } = await admin
    .from('coach_profiles')
    .select('id')
    .eq('athlete_id', sessionAthleteId)
    .maybeSingle();
  return profile || null;
}

async function getCoachProfileFor(admin, sessionAthleteId, targetAthleteId) {
  const profile = await getOwnCoachProfile(admin, sessionAthleteId);
  if (!profile) return null;
  const { data: relationship } = await admin
    .from('coach_athlete_relationships')
    .select('id')
    .eq('coach_id', profile.id)
    .eq('athlete_id', targetAthleteId)
    .eq('status', 'active')
    .maybeSingle();
  return relationship ? profile : null;
}

export default async function handler(req, res) {
  const sessionAthleteId = getAthleteIdFromRequest(req);
  if (!sessionAthleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    if (req.method === 'GET') {
      const targetAthleteId = typeof req.query.athlete_id === 'string' && req.query.athlete_id
        ? req.query.athlete_id
        : sessionAthleteId;

      let isCoachView = false;
      if (targetAthleteId !== sessionAthleteId) {
        const profile = await getCoachProfileFor(admin, sessionAthleteId, targetAthleteId);
        if (!profile) {
          res.status(403).json({ error: 'No active coaching relationship with this athlete.' });
          return;
        }
        isCoachView = true;
      }

      let query = admin
        .from('calendar_notes')
        .select(NOTE_COLUMNS)
        .eq('athlete_id', targetAthleteId)
        .order('note_date', { ascending: true });
      if (typeof req.query.start === 'string' && req.query.start) query = query.gte('note_date', req.query.start);
      if (typeof req.query.end === 'string' && req.query.end) query = query.lte('note_date', req.query.end);
      // Athletes never see a coach's private drafts on their own calendar.
      if (!isCoachView) query = query.eq('visibility', 'athlete_visible');

      const { data, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ notes: data || [] });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const targetAthleteId = body.athlete_id || sessionAthleteId;

      let coachProfile = null;
      if (targetAthleteId !== sessionAthleteId) {
        coachProfile = await getCoachProfileFor(admin, sessionAthleteId, targetAthleteId);
        if (!coachProfile) {
          res.status(403).json({ error: 'No active coaching relationship with this athlete.' });
          return;
        }
      }

      if (!body.note_date || !body.title?.trim()) {
        res.status(400).json({ error: 'note_date and title are required.' });
        return;
      }

      const payload = {
        athlete_id: targetAthleteId,
        coach_id: coachProfile ? coachProfile.id : null,
        note_date: body.note_date,
        title: body.title.trim(),
        body: body.body?.trim() || null,
        note_type: NOTE_TYPES.includes(body.note_type) ? body.note_type : 'general',
        visibility: coachProfile && body.visibility === 'coach_private' ? 'coach_private' : 'athlete_visible',
      };

      const { data, error } = await admin
        .from('calendar_notes')
        .insert(payload)
        .select(NOTE_COLUMNS)
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ note: data });
      return;
    }

    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const id = req.method === 'DELETE' ? (req.query.id || req.body?.id) : req.body?.id;
      if (!id) {
        res.status(400).json({ error: 'id is required.' });
        return;
      }

      const { data: existing } = await admin
        .from('calendar_notes')
        .select(NOTE_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (!existing) {
        res.status(404).json({ error: 'Note not found.' });
        return;
      }

      // Author owns the note: athletes their own (no coach_id), coaches the
      // ones they created for an athlete they still actively coach.
      let allowed = existing.athlete_id === sessionAthleteId && !existing.coach_id;
      if (!allowed && existing.coach_id) {
        const profile = await getCoachProfileFor(admin, sessionAthleteId, existing.athlete_id);
        allowed = Boolean(profile && existing.coach_id === profile.id);
      }
      if (!allowed) {
        res.status(403).json({ error: 'Not allowed to modify this note.' });
        return;
      }

      if (req.method === 'DELETE') {
        const { error } = await admin.from('calendar_notes').delete().eq('id', id);
        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }
        res.status(200).json({ success: true });
        return;
      }

      const updates = { updated_at: new Date().toISOString() };
      if (req.body.title !== undefined) updates.title = String(req.body.title).trim();
      if (req.body.body !== undefined) updates.body = req.body.body ? String(req.body.body).trim() : null;
      if (req.body.note_date !== undefined) updates.note_date = req.body.note_date;
      if (req.body.note_type !== undefined && NOTE_TYPES.includes(req.body.note_type)) updates.note_type = req.body.note_type;
      if (req.body.visibility !== undefined && existing.coach_id) {
        updates.visibility = req.body.visibility === 'coach_private' ? 'coach_private' : 'athlete_visible';
      }

      const { data, error } = await admin
        .from('calendar_notes')
        .update(updates)
        .eq('id', id)
        .select(NOTE_COLUMNS)
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ note: data });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[calendar-notes] failed:', error);
    res.status(500).json({ error: error.message });
  }
}
