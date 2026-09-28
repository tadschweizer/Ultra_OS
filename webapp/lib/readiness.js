/**
 * Dependency readiness checks, kept separate from liveness (/api/health).
 *
 * Liveness answers "is the process up". Readiness answers "can it serve
 * pilot traffic": the database must answer a trivial query within a bound.
 * Results expose only status and latency, never provider messages, hostnames,
 * or environment-variable names.
 */

export const DEFAULT_CHECK_TIMEOUT_MS = 3000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Run one dependency probe with a hard time bound.
 * `probe` resolves when healthy and throws (or resolves {error}) when not.
 * Returns { status: 'ok' | 'down' | 'timeout' | 'unconfigured', latencyMs }.
 */
export async function runCheck(probe, { timeoutMs = DEFAULT_CHECK_TIMEOUT_MS, now = Date.now } = {}) {
  const started = now();
  try {
    const result = await withTimeout(Promise.resolve().then(probe), timeoutMs);
    if (result && result.error) return { status: 'down', latencyMs: now() - started };
    return { status: 'ok', latencyMs: now() - started };
  } catch (error) {
    const latencyMs = now() - started;
    if (error && error.code === 'UNCONFIGURED') return { status: 'unconfigured', latencyMs };
    return { status: error && error.message === 'timeout' ? 'timeout' : 'down', latencyMs };
  }
}

/** Probe the pilot database with a one-row read on a table every account uses. */
export function databaseProbe(getClient) {
  return async () => {
    const client = getClient();
    return client.from('athletes').select('id').limit(1);
  };
}

export async function evaluateReadiness({ checks, timeoutMs, now } = {}) {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, probe]) => [name, await runCheck(probe, { timeoutMs, now })])
  );
  const results = Object.fromEntries(entries);
  const ready = entries.every(([, result]) => result.status === 'ok');
  return { ready, results };
}
