import { getSupabaseAdminClient } from '../../lib/authServer';


export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const { data, error } = await getSupabaseAdminClient()
    .from('research_library_entries')
    .select(
      'id, pubmed_id, title, authors, journal, publication_year, publication_date, pubmed_url, topic_tags, plain_english_summary, practical_takeaway, commentary, ultra_score, gravel_score, triathlon_score, published'
    )
    .eq('published', true)
    .order('publication_date', { ascending: false, nullsFirst: false })
    .order('publication_year', { ascending: false, nullsFirst: false });

  if (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ entries: data || [] });
}
