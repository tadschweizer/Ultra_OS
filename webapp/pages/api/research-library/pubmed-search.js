import cookie from 'cookie';
import { searchPubMed, summarizePubMed } from '../../../lib/pubmed';

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  if (!cookies.athlete_id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  try {
    const pmids = await searchPubMed(query, 8);
    const studies = await summarizePubMed(pmids);
    res.status(200).json({ studies });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search PubMed' });
  }
}
