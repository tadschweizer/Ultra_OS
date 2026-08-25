import { getSupabaseAdminClient } from '../../../lib/authServer';
import {
  requireActiveCoachRelationship,
  requireCoachAccess,
} from '../../../lib/auth/roleAccessServer.js';

// Coach tables are no longer reachable with the public anon key (RLS is on and
// the anon grants are revoked), so this route uses the service-role client.
// Authorisation is enforced in the handler from the session athlete id.
const supabase = getSupabaseAdminClient();

const DOC_TYPES = ['text', 'link', 'file'];

export default async function handler(req, res) {
  const access = await requireCoachAccess(req, res, supabase);
  if (!access) return;

  try {
    const profile = access.profile;

    if (req.method === 'GET') {
      const targetAthleteId = typeof req.query.athlete_id === 'string' ? req.query.athlete_id : null;
      if (!targetAthleteId) {
        res.status(400).json({ error: 'athlete_id query param is required' });
        return;
      }
      const relationship = await requireActiveCoachRelationship(
        res,
        supabase,
        profile.id,
        targetAthleteId
      );
      if (!relationship) return;

      const { data, error } = await supabase
        .from('coach_shared_docs')
        .select('id, athlete_id, title, category, doc_type, content, resource_url, sort_order, created_at, updated_at')
        .eq('coach_id', profile.id)
        .eq('athlete_id', targetAthleteId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ docs: data || [] });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.athlete_id) {
        res.status(400).json({ error: 'athlete_id is required' });
        return;
      }
      if (!body.title?.trim()) {
        res.status(400).json({ error: 'title is required' });
        return;
      }
      if (!DOC_TYPES.includes(body.doc_type)) {
        res.status(400).json({ error: `doc_type must be one of: ${DOC_TYPES.join(', ')}` });
        return;
      }
      if (body.doc_type === 'text' && !body.content?.trim()) {
        res.status(400).json({ error: 'content is required for text docs' });
        return;
      }
      if ((body.doc_type === 'link' || body.doc_type === 'file') && !body.resource_url?.trim()) {
        res.status(400).json({ error: 'resource_url is required for link/file docs' });
        return;
      }

      const relationship = await requireActiveCoachRelationship(
        res,
        supabase,
        profile.id,
        body.athlete_id
      );
      if (!relationship) return;

      const { data, error } = await supabase
        .from('coach_shared_docs')
        .insert({
          coach_id: profile.id,
          athlete_id: body.athlete_id,
          title: body.title.trim(),
          category: body.category?.trim() || 'General',
          doc_type: body.doc_type,
          content: body.content?.trim() || null,
          resource_url: body.resource_url?.trim() || null,
          sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
        })
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ doc: data });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) {
        res.status(400).json({ error: 'id is required' });
        return;
      }

      const { data: existing, error: lookupError } = await supabase
        .from('coach_shared_docs')
        .select('id, athlete_id')
        .eq('id', id)
        .eq('coach_id', profile.id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const relationship = await requireActiveCoachRelationship(
        res,
        supabase,
        profile.id,
        existing.athlete_id
      );
      if (!relationship) return;

      const { error } = await supabase
        .from('coach_shared_docs')
        .delete()
        .eq('id', id)
        .eq('coach_id', profile.id);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
