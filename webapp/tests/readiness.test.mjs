import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadinessHandler } from '../pages/api/ready.js';
import healthHandler from '../pages/api/health.js';
import { runCheck } from '../lib/readiness.js';

function response() {
  return { code: null, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
const clientReturning = (result) => () => ({ from() { return { select() { return { limit: async () => result }; } }; } });
async function call(options, method = 'GET') {
  const alerts = [];
  const handler = createReadinessHandler({ alert: (r) => alerts.push(r), ...options });
  const res = response();
  await handler({ method }, res);
  return { res, alerts };
}

test('liveness stays independent of dependencies', () => {
  const res = response();
  healthHandler({ method: 'GET' }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('ready: healthy database returns 200 with no alert', async () => {
  const { res, alerts } = await call({ getClient: clientReturning({ data: [{ id: 1 }], error: null }) });
  assert.equal(res.code, 200);
  assert.equal(res.body.status, 'ready');
  assert.equal(res.body.checks.database.status, 'ok');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(alerts.length, 0);
});

test('not ready: database error returns 503, alerts, and leaks no provider detail', async () => {
  const secret = 'connection to db.internal.example failed SUPABASE_SERVICE_ROLE_KEY';
  const { res, alerts } = await call({ getClient: clientReturning({ data: null, error: { message: secret } }) });
  assert.equal(res.code, 503);
  assert.equal(res.body.status, 'not_ready');
  assert.equal(res.body.checks.database.status, 'down');
  assert.equal(JSON.stringify(res.body).includes('internal'), false);
  assert.equal(JSON.stringify(res.body).includes('SUPABASE'), false);
  assert.equal(alerts.length, 1);
});

test('not ready: thrown client error is contained', async () => {
  const { res } = await call({ getClient: () => { throw new Error('SUPABASE_SERVICE_ROLE_KEY missing'); } });
  assert.equal(res.code, 503);
  assert.equal(res.body.checks.database.status, 'down');
  assert.equal(JSON.stringify(res.body).includes('SUPABASE'), false);
});

test('not ready: missing configuration is reported as unconfigured', async () => {
  const { res } = await call({ getClient: () => { const e = new Error('x'); e.code = 'UNCONFIGURED'; throw e; } });
  assert.equal(res.code, 503);
  assert.equal(res.body.checks.database.status, 'unconfigured');
});

test('not ready: a hung database is cut off at the time bound', async () => {
  const hung = () => ({ from() { return { select() { return { limit: () => new Promise(() => {}) }; } }; } });
  const started = Date.now();
  const { res, alerts } = await call({ getClient: hung, timeoutMs: 50 });
  assert.ok(Date.now() - started < 1000);
  assert.equal(res.code, 503);
  assert.equal(res.body.checks.database.status, 'timeout');
  assert.equal(alerts.length, 1);
});

test('non-GET methods are rejected without touching dependencies', async () => {
  let touched = false;
  const { res } = await call({ getClient: () => { touched = true; } }, 'POST');
  assert.equal(res.code, 405);
  assert.equal(touched, false);
});

test('runCheck reports latency', async () => {
  let t = 0;
  const result = await runCheck(async () => { t = 40; }, { now: () => t });
  assert.deepEqual(result, { status: 'ok', latencyMs: 40 });
});

test('default client requires the service-role key, so misconfiguration is not reported as an outage', async () => {
  const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, role: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const res = response();
    await createReadinessHandler({ alert() {} })({ method: 'GET' }, res);
    assert.equal(res.code, 503);
    assert.equal(res.body.checks.database.status, 'unconfigured');
  } finally {
    for (const [k, v] of [['NEXT_PUBLIC_SUPABASE_URL', saved.url], ['NEXT_PUBLIC_SUPABASE_ANON_KEY', saved.anon], ['SUPABASE_SERVICE_ROLE_KEY', saved.role]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});
