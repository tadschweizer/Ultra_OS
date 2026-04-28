import { getSupabaseAdminClient } from '../../../lib/authServer';
import {
  RESEARCH_TOPICS,
  getLocalResearchPapers,
  getResearchTopicSummary,
} from '../../../lib/researchEngine';

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return req.headers.authorization === `Bearer ${cronSecret}`;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const admin = getSupabaseAdminClient();
  const results = [];

  try {
    for (const topic of RESEARCH_TOPICS) {
      const papers = await getLocalResearchPapers({ admin, query: topic.query, limit: 30 });
      const summary = await getResearchTopicSummary({ admin, query: topic.query, papers });
      results.push({
        topicKey: summary.topicKey,
        topicLabel: summary.topicLabel,
        confidence: summary.confidence,
        paperCount: papers.length,
      });
    }

    res.status(200).json({ summarized: results.length, results });
  } catch (error) {
    console.error('[cron/research-summarize] failed:', error);
    res.status(500).json({
      error:
        error.message || 'Research summarization failed. Confirm the research engine migration has been applied.',
      results,
    });
  }
}
