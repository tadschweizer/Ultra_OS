import { ConnectorClient } from '../../../lib/connectorClient';

export const runtime = 'edge';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const provider = req.url.split('/').slice(-2)[0];
  const { raw_payload = {}, cursor = {} } = req.body || {};

  const normalized = ConnectorClient.normalizeMetrics(provider, raw_payload);
  const nextCursor = {
    ...ConnectorClient.makeCursor(cursor),
    last_incremental_sync_at: new Date().toISOString(),
  };

  res.status(200).json({
    provider,
    normalized,
    cursor: nextCursor,
    data_quality_score: null,
    note: 'Placeholder sync route. Wire Supabase persistence + provider fetch once API keys are available.',
  });
}
