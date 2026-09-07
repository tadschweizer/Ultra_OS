// Isolated PostgreSQL engine (PGlite/WASM), not Supabase Auth or staging evidence.
// Install the pinned test-only runtime outside webapp, as documented in the runbook.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '../../output/pilot-sql/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE public.athletes (id uuid PRIMARY KEY);
    CREATE TABLE public.coach_profiles (id uuid PRIMARY KEY, athlete_id uuid REFERENCES public.athletes(id));
    CREATE TABLE public.coach_athlete_relationships (id uuid PRIMARY KEY);
    INSERT INTO public.athletes VALUES ('11111111-1111-4111-8111-111111111111');
    INSERT INTO public.coach_profiles VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111');
  `);
  const migration = await fs.readFile(new URL('../supabase/migrations/20260907025635_pilot_coach_entitlements.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  const version = await db.query('select version()');
  console.log(version.rows[0].version);
  const rls = await db.query("select relname, relrowsecurity from pg_class where relname in ('coach_pilot_entitlements','checkin_rate_buckets')");
  assert.equal(rls.rows.length, 2);
  assert.ok(rls.rows.every(row => row.relrowsecurity));
  let denials = 0;
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    for (const table of ['coach_pilot_entitlements', 'checkin_rate_buckets']) {
      for (const sql of [`SELECT * FROM public.${table}`, `INSERT INTO public.${table} DEFAULT VALUES`,
        `UPDATE public.${table} SET ${table === 'coach_pilot_entitlements' ? "reason='forged'" : 'attempts=1'}`, `DELETE FROM public.${table}`]) {
        await assert.rejects(db.query(sql), error => error.code === '42501'); denials++;
      }
    }
    await assert.rejects(db.query("select public.consume_checkin_rate_limit('11111111-1111-4111-8111-111111111111')"), error => error.code === '42501');
    denials++;
    await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  await db.exec(`INSERT INTO public.coach_pilot_entitlements (coach_id, expires_at, reason)
    VALUES ('33333333-3333-4333-8333-333333333333', now() + interval '30 days', 'Approved pilot');`);
  await assert.rejects(db.exec(`UPDATE public.coach_pilot_entitlements SET expires_at=starts_at`), error => error.code === '23514');
  const calls = await db.query("select public.consume_checkin_rate_limit('11111111-1111-4111-8111-111111111111') as allowed from generate_series(1,31)");
  assert.equal(calls.rows.filter(row => row.allowed).length, 30);
  assert.equal(calls.rows[30].allowed, false);
  await db.exec("update public.checkin_rate_buckets set window_start=now()-interval '2 minutes'");
  assert.equal((await db.query("select public.consume_checkin_rate_limit('11111111-1111-4111-8111-111111111111') as allowed")).rows[0].allowed, true);
  await db.exec('RESET ROLE');
  const functions = await db.query("select prosecdef, proconfig from pg_proc where proname='consume_checkin_rate_limit'");
  assert.equal(functions.rows[0].prosecdef, false);
  console.log(`PASS: migration executes, ${denials} client-role permission denials, RLS enabled, service-role writes, expiry constraint, 30/31 rate boundary, next-window recovery, invoker function.`);
} finally { await db.close(); }
