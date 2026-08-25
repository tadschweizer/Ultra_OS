import { getSupabaseAdminClient } from '../../../lib/authServer';
import { countGroupMembers } from '../../../lib/coach/groupMembership';
import { requireCoachAccess } from '../../../lib/auth/roleAccessServer.js';

// Coach tables are no longer reachable with the public anon key (RLS is on and
// the anon grants are revoked), so this route uses the service-role client.
// Authorisation is enforced in the handler from the session athlete id.
const supabase = getSupabaseAdminClient();

export default async function handler(req, res) {
  const access = await requireCoachAccess(req, res, supabase);
  if (!access) return;
  const profile = access.profile;

  if (req.method === 'GET') {
    const { data: groups, error } = await supabase.from('coach_groups').select('id, name, description, created_at, coach_group_members(athlete_id, athletes(id, name, email))').eq('coach_id', profile.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ groups: countGroupMembers(groups || []) });
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { data, error } = await supabase.from('coach_groups').insert({ coach_id: profile.id, name: body.name.trim(), description: body.description?.trim() || null }).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ group: data });
  }
  if (req.method === 'PUT') {
    const body = req.body || {};
    if (!body.group_id) return res.status(400).json({ error: 'group_id is required' });
    const { data: group, error: groupError } = await supabase.from('coach_groups').select('id, coach_id').eq('id', body.group_id).eq('coach_id', profile.id).maybeSingle();
    if (groupError) return res.status(500).json({ error: groupError.message });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (body.athlete_id) {
      const { data: relationship, error: relationshipError } = await supabase
        .from('coach_athlete_relationships')
        .select('id, status')
        .eq('coach_id', profile.id)
        .eq('athlete_id', body.athlete_id)
        .in('status', ['active', 'accepted'])
        .maybeSingle();
      if (relationshipError) return res.status(500).json({ error: relationshipError.message });
      if (!relationship) return res.status(400).json({ error: 'Athlete is not on your active roster' });

      if (body.action === 'remove') {
        const { error } = await supabase.from('coach_group_members').delete().eq('group_id', body.group_id).eq('athlete_id', body.athlete_id);
        if (error) return res.status(500).json({ error: error.message });
      } else {
        const { error } = await supabase.from('coach_group_members').upsert({ group_id: body.group_id, athlete_id: body.athlete_id });
        if (error) return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    }
    const { data, error } = await supabase.from('coach_groups').update({ name: body.name, description: body.description }).eq('id', body.group_id).eq('coach_id', profile.id).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ group: data });
  }
  if (req.method === 'DELETE') {
    const body = req.body || {};
    if (!body.group_id) return res.status(400).json({ error: 'group_id is required' });
    const { error } = await supabase.from('coach_groups').delete().eq('id', body.group_id).eq('coach_id', profile.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).end();
}
