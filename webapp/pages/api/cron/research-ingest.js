import { getSupabaseAdminClient } from '../../../lib/authServer';
import {
  RESEARCH_TOPICS,
  fetchExternalResearchPapers,
  upsertImportedResearchPapers,
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
  const requestedTopic = typeof req.query.topic === 'string' ? req.query.topic : '';
  const topics = requestedTopic
    ? RESEARCH_TOPICS.filter((topic) => topic.key === requestedTopic || topic.label.toLowerCase() === requestedTopic.toLowerCase())
    : RESEARCH_TOPICS.slice(0, 8);

  const runStartedAt = new Date().toISOString();
  let run = null;

  try {
    const { data } = await admin
      .from('research_ingestion_runs')
      .insert({
        run_type: 'scheduled_ingest',
        status: 'running',
        started_at: runStartedAt,
        query_count: topics.length,
      })
      .select('id')
      .single();
    run = data;
  } catch (error) {
    res.status(500).json({
      error:
        'Research migration is required before ingestion can run. Apply the research engine SQL migration, then retry.',
      detail: error.message,
    });
    return;
  }

  const results = [];
  let importedCount = 0;

  try {
    for (const topic of topics) {
      const external = await fetchExternalResearchPapers(topic.query, 18);
      const imported = await upsertImportedResearchPapers(admin, {
        query: topic.query,
        papers: external.papers,
        runId: run?.id,
      });
      importedCount += imported.length;
      results.push({
        topic: topic.label,
        query: topic.query,
        found: external.papers.length,
        imported: imported.length,
        sourceErrors: external.errors,
      });
    }

    await admin
      .from('research_ingestion_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        imported_count: importedCount,
        result_payload: { results },
      })
      .eq('id', run.id);

    res.status(200).json({ runId: run.id, imported: importedCount, results });
  } catch (error) {
    await admin
      .from('research_ingestion_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error.message || 'Research ingest failed.',
        result_payload: { results },
      })
      .eq('id', run.id);

    console.error('[cron/research-ingest] failed:', error);
    res.status(500).json({ error: error.message || 'Research ingest failed.', results });
  }
}
