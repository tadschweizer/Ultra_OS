import { getSupabaseAdminClient } from '../../../lib/authServer';
import {
  getLocalResearchPapers,
  getResearchTopicSummary,
  resolveResearchTopic,
} from '../../../lib/researchEngine';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const topic = resolveResearchTopic(query);
  const effectiveQuery = query || topic?.query || 'endurance performance';

  try {
    const admin = getSupabaseAdminClient();
    const papers = await getLocalResearchPapers({ admin, query: effectiveQuery, limit: 12 });
    const summary = await getResearchTopicSummary({ admin, query: effectiveQuery, papers });

    res.status(200).json({ summary, papers });
  } catch (error) {
    console.error('[research/topic-summary] failed:', error);
    res.status(500).json({ error: error.message || 'Failed to load topic summary.' });
  }
}
