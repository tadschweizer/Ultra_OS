import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../../lib/authServer';
import { DEFAULT_GROUP_COLOR, sanitizeCoachGroupColor, sanitizeCoachGroupName } from '../../../lib/coachGroups';
import { ensureCoachProfile } from '../../../lib/coachServer';

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    const { data: athlete, error: athleteError } = await admin
      .from('athletes')
      .select('id, name, email')
      .eq('id', athleteId)
      .maybeSingle();

    if (athleteError) throw athleteError;
    if (!athlete) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const profile = await ensureCoachProfile(admin, athlete);

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('coach_groups')
        .select('id, coach_id, name, color, sort_order, created_at, updated_at')
        .eq('coach_id', profile.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      res.status(200).json({ groups: data || [] });
      return;
    }

    if (req.method === 'POST') {
      const name = sanitizeCoachGroupName(req.body?.name);
      const color = sanitizeCoachGroupColor(req.body?.color || DEFAULT_GROUP_COLOR);

      if (!name) {
        res.status(400).json({ error: 'Group name is required.' });
        return;
      }

      const { data: existing, error: existingError } = await admin
        .from('coach_groups')
        .select('id, sort_order')
        .eq('coach_id', profile.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      if (existingError) throw existingError;

      const sortOrder = Number(existing?.[0]?.sort_order || 0) + 1;
      const { data, error } = await admin
        .from('coach_groups')
        .insert({
          coach_id: profile.id,
          name,
          color,
          sort_order: sortOrder,
        })
        .select('id, coach_id, name, color, sort_order, created_at, updated_at')
        .single();

      if (error) throw error;
      res.status(200).json({ group: data });
      return;
    }

    if (req.method === 'PATCH') {
      const id = req.body?.id;
      if (!id) {
        res.status(400).json({ error: 'Group id is required.' });
        return;
      }

      const updates = {};
      if (req.body?.name !== undefined) {
        const name = sanitizeCoachGroupName(req.body.name);
        if (!name) {
          res.status(400).json({ error: 'Group name cannot be empty.' });
          return;
        }
        updates.name = name;
      }
      if (req.body?.color !== undefined) {
        updates.color = sanitizeCoachGroupColor(req.body.color);
      }
      if (req.body?.sort_order !== undefined) {
        updates.sort_order = Math.max(0, Number(req.body.sort_order) || 0);
      }

      const { data, error } = await admin
        .from('coach_groups')
        .update(updates)
        .eq('id', id)
        .eq('coach_id', profile.id)
        .select('id, coach_id, name, color, sort_order, created_at, updated_at')
        .single();

      if (error) throw error;
      res.status(200).json({ group: data });
      return;
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
      if (!id) {
        res.status(400).json({ error: 'Group id is required.' });
        return;
      }

      const { data: group, error: groupError } = await admin
        .from('coach_groups')
        .select('id, name')
        .eq('id', id)
        .eq('coach_id', profile.id)
        .maybeSingle();

      if (groupError) throw groupError;
      if (!group) {
        res.status(404).json({ error: 'Group not found.' });
        return;
      }

      const { error: relationshipError } = await admin
        .from('coach_athlete_relationships')
        .update({ group_name: null })
        .eq('coach_id', profile.id)
        .eq('group_name', group.name);

      if (relationshipError) throw relationshipError;

      const { error } = await admin
        .from('coach_groups')
        .delete()
        .eq('id', id)
        .eq('coach_id', profile.id);

      if (error) throw error;
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error('[coach/groups] failed:', error);
    res.status(500).json({ error: error.message || 'Could not manage coach groups.' });
  }
}
