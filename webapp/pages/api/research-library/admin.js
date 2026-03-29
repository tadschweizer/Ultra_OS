import cookie from 'cookie';
import { getAdminPool } from '../../../lib/postgresAdmin';

function requireAthlete(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const athleteId = cookies.athlete_id;
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return athleteId;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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
  const athleteId = requireAthlete(req, res);
  if (!athleteId) return;

  let pool;
  try {
    pool = getAdminPool();
  } catch (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        'select * from public.research_library_entries order by publication_date desc nulls last, inserted_at desc'
      );
      res.status(200).json({ entries: result.rows || [] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'POST') {
    const payload = normalizePayload(req.body || {});
    if (!payload.title || !payload.pubmed_url) {
      res.status(400).json({ error: 'Title and PubMed URL are required' });
      return;
    }

    try {
      const result = await pool.query(
        `insert into public.research_library_entries
          (pubmed_id, title, authors, journal, publication_year, publication_date, pubmed_url, topic_tags,
           plain_english_summary, practical_takeaway, commentary, ultra_score, gravel_score, triathlon_score, published, updated_at)
         values
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
         returning *`,
        [
          payload.pubmed_id,
          payload.title,
          payload.authors,
          payload.journal,
          payload.publication_year,
          payload.publication_date,
          payload.pubmed_url,
          payload.topic_tags,
          payload.plain_english_summary,
          payload.practical_takeaway,
          payload.commentary,
          payload.ultra_score,
          payload.gravel_score,
          payload.triathlon_score,
          payload.published,
        ]
      );
      res.status(200).json({ entry: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'PUT') {
    const { id } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Entry id is required' });
      return;
    }

    const payload = normalizePayload(req.body || {});

    try {
      const result = await pool.query(
        `update public.research_library_entries
         set pubmed_id = $1,
             title = $2,
             authors = $3,
             journal = $4,
             publication_year = $5,
             publication_date = $6,
             pubmed_url = $7,
             topic_tags = $8,
             plain_english_summary = $9,
             practical_takeaway = $10,
             commentary = $11,
             ultra_score = $12,
             gravel_score = $13,
             triathlon_score = $14,
             published = $15,
             updated_at = now()
         where id = $16
         returning *`,
        [
          payload.pubmed_id,
          payload.title,
          payload.authors,
          payload.journal,
          payload.publication_year,
          payload.publication_date,
          payload.pubmed_url,
          payload.topic_tags,
          payload.plain_english_summary,
          payload.practical_takeaway,
          payload.commentary,
          payload.ultra_score,
          payload.gravel_score,
          payload.triathlon_score,
          payload.published,
          id,
        ]
      );
      res.status(200).json({ entry: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
    if (!id) {
      res.status(400).json({ error: 'Entry id is required' });
      return;
    }

    try {
      await pool.query('delete from public.research_library_entries where id = $1', [id]);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(405).end();
}
