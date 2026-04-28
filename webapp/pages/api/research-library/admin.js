import { createClient } from '@supabase/supabase-js';
import { requireAdminRequest } from '../../../lib/authServer';


function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase admin credentials.');
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return value.split(',').map((t) => t.trim()).filter(Boolean);
}

function parseOptionalInt(value, defaultValue = 0) {
  if (value === '' || value === null || value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function normalizePayload(body = {}) {
  return {
    pubmed_id: body.pubmed_id || null,
    title: body.title?.trim() || '',
    authors: body.authors?.trim() || null,
    journal: body.journal?.trim() || null,
    publication_year: body.publication_year ? parseInt(body.publication_year, 10) : null,
    publication_date: body.publication_date || null,
    pubmed_url: body.pubmed_url?.trim() || '',
    topic_tags: normalizeTags(body.topic_tags),
    plain_english_summary: body.plain_english_summary?.trim() || null,
    practical_takeaway: body.practical_takeaway?.trim() || null,
    commentary: body.commentary?.trim() || null,
    ultra_score: parseOptionalInt(body.ultra_score, 0),
    gravel_score: parseOptionalInt(body.gravel_score, 0),
    triathlon_score: parseOptionalInt(body.triathlon_score, 0),
    published: Boolean(body.published),
  };
}

export default async function handler(req, res) {
  const adminContext = await requireAdminRequest(req, res);
  if (!adminContext) return;

  let supabase;
  try {
    supabase = getAdminClient();
  } catch (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('research_library_entries')
      .select('*')
      .order('publication_date', { ascending: false, nullsFirst: false })
      .order('inserted_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ entries: data || [] });
  }

  if (req.method === 'POST') {
    const payload = normalizePayload(req.body || {});
    if (!payload.title || !payload.pubmed_url) {
      return res.status(400).json({ error: 'Title and PubMed URL are required' });
    }
    const { data, error } = await supabase
      .from('research_library_entries')
      .insert({ ...payload, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ entry: data });
  }

  if (req.method === 'PUT') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Entry id is required' });
    const payload = normalizePayload(req.body || {});
    const { data, error } = await supabase
      .from('research_library_entries')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ entry: data });
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
    if (!id) return res.status(400).json({ error: 'Entry id is required' });
    const { error } = await supabase
      .from('research_library_entries')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).end();
}
