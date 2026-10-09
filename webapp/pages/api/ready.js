import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';
import { databaseProbe, schemaProbe, evaluateReadiness } from '../../lib/readiness.js';

function getReadinessClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const error = new Error('unconfigured');
    error.code = 'UNCONFIGURED';
    throw error;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Readiness endpoint. /api/health stays a cheap liveness probe; this route
 * reports whether required dependencies answer within a bound. 200 = ready,
 * 503 = not ready. Failures raise one structured log line and a Sentry
 * message (which drives alerting); the body never carries provider detail.
 */
export function createReadinessHandler({
  getClient = getReadinessClient,
  timeoutMs,
  now,
  alert = defaultAlert,
} = {}) {
  return async function handler(req, res) {
    res.setHeader?.('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader?.('Allow', 'GET, HEAD');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const { ready, results } = await evaluateReadiness({
      checks: { database: databaseProbe(getClient), schema: schemaProbe(getClient) },
      timeoutMs,
      now,
    });
    if (!ready) alert(results);
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks: results });
  };
}

function defaultAlert(results) {
  const failing = Object.entries(results)
    .filter(([, result]) => result.status !== 'ok')
    .map(([name, result]) => `${name}:${result.status}`);
  console.error(JSON.stringify({ event: 'readiness_failed', failing }));
  try {
    Sentry.captureMessage(`Readiness failed: ${failing.join(', ')}`, { level: 'error', tags: { area: 'readiness' } });
  } catch {
    // Alerting must never turn a readiness report into a crash.
  }
}

export default createReadinessHandler();
