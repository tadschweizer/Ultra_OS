import { searchPubMed, summarizePubMed } from '../../../lib/pubmed';

function buildSportsScienceQuery(query) {
  const normalized = String(query || '').trim();
  const lower = normalized.toLowerCase();
  const hasSportContext = ['exercise', 'athlete', 'endurance', 'sport', 'performance', 'running', 'cycling', 'triathlon'].some((term) =>
    lower.includes(term)
  );
  const phrase = normalized.replace(/"/g, '');
  const topicClause = `"${phrase}"[Title/Abstract] OR ${phrase}`;
  const sportClause =
    '"Exercise"[Mesh] OR exercise[Title/Abstract] OR athlete*[Title/Abstract] OR endurance[Title/Abstract] OR sport*[Title/Abstract] OR running[Title/Abstract] OR cycling[Title/Abstract] OR triathlon[Title/Abstract]';
  return hasSportContext
    ? normalized
    : `(${topicClause}) AND (${sportClause})`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  const requestedRetmax = parseInt(req.query.retmax, 10);
  const retmax = Number.isFinite(requestedRetmax) ? Math.min(Math.max(requestedRetmax, 1), 12) : 8;

  try {
    const pmids = await searchPubMed(buildSportsScienceQuery(query), retmax);
    const studies = await summarizePubMed(pmids);
    res.status(200).json({ studies });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search PubMed' });
  }
}
