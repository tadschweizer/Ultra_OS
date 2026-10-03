// Opt-in destructive acceptance checks, restricted to the named local QA stack.
// Run from webapp after starting the runbook's separate Supabase CLI project.
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const stack = '../output/p010-012-supabase';
const status = JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase',
  ['status', '--workdir', stack, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1');
assert.equal(new URL(status.DB_URL).hostname, '127.0.0.1');
const db = new pg.Client({ connectionString: status.DB_URL });
await db.connect();
const results = { environment: 'isolated local Supabase, real PostgREST/Auth/Storage', date: new Date().toISOString(), completed: false, checks: [], migrationFailures: [] };
if (!process.argv.includes('--bootstrap')) {
  try { results.migrationFailures = JSON.parse(await readFile('../output/p010-012-local-supabase-acceptance.json', 'utf8')).migrationFailures; } catch {}
}
const pass = name => { results.checks.push(name); console.log(`PASS: ${name}`); };
const checked = async promise => { const result = await promise; if (result.error) throw result.error; return result.data; };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
process.env.SESSION_COOKIE_SECRET = crypto.randomBytes(32).toString('hex');
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
process.env.ALLOW_DEMO_SEED = 'true';
process.env.APP_ENV = 'staging';
const { signAthleteSession } = await import('../lib/auth/sessionCookies.js');
const { createDemoHandler } = await import('../pages/api/admin/demo.js');
const { createAccountExportHandler } = await import('../pages/api/account-export.js');
const { createDeleteAccountHandler } = await import('../pages/api/delete-account.js');
function request(id, method = 'POST', body = {}) {
  return { method, body, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json',
    cookie: `athlete_id=${encodeURIComponent(signAthleteSession(id))}` } };
}
async function invoke(handler, req) {
  const res = { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; },
    getHeader(key) { return this.headers[key]; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res); return res;
}
try {
  if (process.argv.includes('--bootstrap')) {
    // Only allowed on a fresh database: never replay historical migrations over populated QA data.
    const existing = await db.query("select to_regclass('public.athletes') as athletes");
    assert.equal(existing.rows[0].athletes, null, 'Bootstrap requires a fresh local QA database');
    await db.query(await readFile('supabase/schema.sql', 'utf8'));
    const files = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort((a,b) =>
      a.replaceAll('-', '').localeCompare(b.replaceAll('-', '')));
    for (const file of files) {
      await db.query('begin');
      try { await db.query(await readFile(`supabase/migrations/${file}`, 'utf8')); await db.query('commit'); }
      catch (error) { await db.query('rollback'); results.migrationFailures.push({ file, code: error.code, message: error.message }); console.log(`BOOTSTRAP GAP: ${file}: ${error.message}`); }
    }
    pass(`Repository schema plus ${files.length - results.migrationFailures.length}/${files.length} historical migrations applied transactionally`);
  }
  // Verify the prerequisite first; apply only the two explicitly scoped files, in order.
  for (const file of ['20261001120000_tiered_athlete_coach_plans.sql', '20261001231152_billing_webhook_reconciliation.sql']) {
    await db.query(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  const constraint = await db.query("select pg_get_constraintdef(oid) as definition from pg_constraint where conname='athletes_subscription_tier_check'");
  assert.match(constraint.rows[0].definition, /coach_pro/); pass('Tier prerequisite applied before reconciliation migration');
  await db.query("notify pgrst, 'reload schema'");
  // Wait for PostgREST's asynchronous schema-cache reload, retrying only a missing RPC.
  const customer = `cus_local_${crypto.randomUUID()}`;
  const event = `evt_local_${crypto.randomUUID()}`;
  const athlete = await checked(admin.from('athletes').insert({ name: 'Disposable RPC acceptance', stripe_customer_id: customer }).select().single());
  let claim;
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await admin.rpc('claim_billing_webhook', { p_event_id: event, p_customer_id: customer, p_event_type: 'customer.subscription.updated' });
    if (!response.error) { claim = response.data; break; }
    if (response.error.code !== 'PGRST202') throw response.error;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(claim?.lease_token);
  const competing = await checked(admin.rpc('claim_billing_webhook', { p_event_id: `${event}_competing`, p_customer_id: customer, p_event_type: 'customer.subscription.updated' }));
  assert.equal(competing.busy, true);
  const finishArgs = { p_event_id: event, p_customer_id: customer, p_lease_token: claim.lease_token, p_athlete_id: athlete.id,
    p_snapshot: { subscription_id: `sub_local_${crypto.randomUUID()}`, price_id: 'price_local', status: 'active', tier: 'pro', activated_at: new Date().toISOString() } };
  const invalid = await admin.rpc('finish_billing_webhook', { ...finishArgs, p_snapshot: { ...finishArgs.p_snapshot, tier: 'unknown' } });
  assert.ok(invalid.error);
  assert.equal((await checked(admin.from('athletes').select('subscription_tier').eq('id', athlete.id).single())).subscription_tier, 'free');
  await checked(admin.rpc('finish_billing_webhook', finishArgs));
  assert.equal((await checked(admin.from('athletes').select('subscription_tier').eq('id', athlete.id).single())).subscription_tier, 'pro');
  assert.deepEqual(await checked(admin.rpc('claim_billing_webhook', { p_event_id: event, p_customer_id: customer, p_event_type: 'customer.subscription.updated' })), { duplicate: true });
  pass('Service-role PostgREST claim/contention/rollback/atomic finish/durable replay');
  const retryArgs = { p_event_id: `${event}_retry`, p_customer_id: customer, p_event_type: 'invoice.paid' };
  const retry = await checked(admin.rpc('claim_billing_webhook', retryArgs));
  await checked(admin.rpc('release_billing_webhook', { p_customer_id: customer, p_lease_token: retry.lease_token }));
  assert.ok((await checked(admin.rpc('claim_billing_webhook', retryArgs))).lease_token); pass('Service-role PostgREST release permits retry');
  const email = `isolated-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomBytes(20).toString('base64url');
  const user = await checked(admin.auth.admin.createUser({ email, password, email_confirm: true }));
  const auth = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await checked(auth.auth.signInWithPassword({ email, password }));
  for (const [label, client] of [['anonymous', anon], ['authenticated', auth]]) {
    for (const [name, args] of [['claim_billing_webhook', retryArgs], ['finish_billing_webhook', finishArgs], ['release_billing_webhook', { p_customer_id: customer, p_lease_token: claim.lease_token }]]) {
      assert.ok((await client.rpc(name, args)).error, `${label} cannot call ${name}`);
    }
    const receipts = await client.schema('billing_private').from('webhook_receipts').select('*');
    assert.ok(receipts.error); pass(`${label}: all billing RPCs denied and private schema unexposed`);
  }
  const operator = await checked(admin.from('athletes').insert({ name: 'Disposable local admin', is_admin: true }).select().single());
  const demo = createDemoHandler({ getClient: () => admin });
  const seeded = await invoke(demo, request(operator.id, 'POST', { reset: true }));
  assert.equal(seeded.code, 200, JSON.stringify(seeded.body));
  const pair = seeded.body.credentials;
  await mkdir('.qa-private', { recursive: true });
  await writeFile('.qa-private/local-demo.json', JSON.stringify(pair, null, 2));
  for (const role of ['coach', 'athlete']) {
    const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    await checked(client.auth.signInWithPassword({ email: pair[role].email, password: pair[role].password }));
    const row = await checked(admin.from('athletes').select('primary_role').eq('id', pair[role].id).single());
    assert.equal(row.primary_role, role);
  }
  const workouts = await checked(admin.from('planned_workouts').select('id').eq('athlete_id', pair.athlete.id));
  assert.ok(workouts.length > 0); pass('Actual demo API seeds linked pair, populated workouts and real Auth sign-ins');
  const exported = await invoke(createAccountExportHandler({ getClient: () => admin }), request(pair.athlete.id));
  assert.equal(exported.code, 200, JSON.stringify(exported.body));
  assert.ok(exported.body.sections.planned_workouts.length > 0);
  assert.ok(exported.body.sections.interventions.length > 0);
  assert.equal(exported.body.sections.profile.id, pair.athlete.id);
  assert.doesNotMatch(JSON.stringify(exported.body.sections.profile), /supabase_user_id|session_version|stripe_/);
  pass('Populated personal export through actual PostgREST, signed/revocable session and handler');
  const disposable = await checked(admin.from('athletes').insert({ name: 'Disposable deletion', email, supabase_user_id: user.user.id }).select().single());
  await checked(admin.from('interventions').insert({ athlete_id: disposable.id, notes: 'delete me' }));
  const bucket = `local-deletion-${crypto.randomUUID()}`;
  await checked(admin.storage.createBucket(bucket, { public: false }));
  const policy = `local_upload_${crypto.randomUUID().replaceAll('-', '')}`;
  await db.query(`create policy ${policy} on storage.objects for insert to authenticated with check (bucket_id='${bucket}' and (storage.foldername(name))[1]=auth.uid()::text)`);
  await checked(auth.storage.from(bucket).upload(`${user.user.id}/private.txt`, Buffer.from('Disposable private uploaded data'), { contentType: 'text/plain' }));
  const deleted = await invoke(createDeleteAccountHandler({ getClient: () => admin }), request(disposable.id, 'DELETE', { confirm: 'DELETE MY ACCOUNT' }));
  assert.equal(deleted.code, 200, JSON.stringify(deleted.body));
  assert.equal(await checked(admin.from('athletes').select('id').eq('id', disposable.id).maybeSingle()), null);
  assert.equal((await checked(admin.from('interventions').select('id').eq('athlete_id', disposable.id))).length, 0);
  const objects = await checked(admin.storage.from(bucket).list(user.user.id));
  results.deletion = { response: deleted.body, remainingUploadedFiles: objects.length };
  pass('Populated disposable account deletion removes athlete and cascading training records');
  assert.equal((await invoke(createAccountExportHandler({ getClient: () => admin }), request(disposable.id))).code, 401);
  const staleRead = await auth.from('athletes').select('*');
  assert.ok(staleRead.error || staleRead.data.length === 0);
  pass('Deleted signed session rejected; real Auth JWT cannot read private athlete rows');
  // Explicitly clean provider/storage leftovers; record before cleaning, do not claim workflow erased them.
  await checked(admin.storage.from(bucket).remove([`${user.user.id}/private.txt`]));
  await checked(admin.storage.deleteBucket(bucket));
  if (deleted.body.auth_cleanup !== 'done') await checked(admin.auth.admin.deleteUser(user.user.id));
  await db.query(`drop policy ${policy} on storage.objects`);
  await checked(admin.from('athletes').delete().in('id', [athlete.id, operator.id]));
  console.log(`DELETION LIMIT: uploaded files remaining=${objects.length}, auth_cleanup=${deleted.body.auth_cleanup}; provider cleanup performed separately`);
  results.demo = { coach: pair.coach.id, athlete: pair.athlete.id, credentialsFile: 'webapp/.qa-private/local-demo.json' };
  results.completed = true;
} finally {
  await mkdir('../output', { recursive: true });
  await writeFile('../output/p010-012-local-supabase-acceptance.json', JSON.stringify(results, null, 2));
  await db.end();
}
