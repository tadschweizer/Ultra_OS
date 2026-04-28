import { getSupabaseAdminClient } from '../../../lib/authServer';
import { searchResearch } from '../../../lib/researchEngine';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 4), 30) : 18;
  const includeExternal = req.query.external !== '0';

  try {
    const result = await searchResearch({
      admin: getSupabaseAdminClient(),
      query,
      limit,
      includeExternal,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[research/search] failed:', error);
    res.status(500).json({ error: error.message || 'Failed to search research.' });
  }
}
