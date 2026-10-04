// Launch against the isolated QA stack, overriding every .env.local setting.
// Never reuse a production provider key for this disposable acceptance server.
import { execFileSync, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const status = JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase',
  ['status', '--workdir', '../output/p010-012-supabase', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1');
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/STRIPE|SUPABASE|RESEND|SENTRY|STRAVA|GARMIN|COROS|OURA|ULTRAHUMAN|EXA/.test(key)) env[key] = '';
}
for (const filename of ['.env', '.env.local', '.env.development', '.env.development.local']) {
  try { for (const line of (await readFile(filename, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/); if (match) env[match[1]] = '';
  } } catch {}
}
Object.assign(env, { APP_ENV: 'staging', NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, SESSION_COOKIE_SECRET: crypto.randomBytes(32).toString('hex'),
  ALLOW_DEMO_SEED: 'false', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', RESEND_API_KEY: '',
  STRAVA_CLIENT_SECRET: '', SENTRY_AUTH_TOKEN: '', NEXT_PUBLIC_SENTRY_DSN: '', SENTRY_DSN: '' });
if (process.argv.includes('--strava-fixture')) Object.assign(env, {
  STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 'local-fixture-only',
  STRAVA_QA_API_ORIGIN: 'http://127.0.0.1:3102',
});
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3100', '-H', '127.0.0.1'], { env, stdio: 'inherit' });
child.on('exit', code => process.exit(code || 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
