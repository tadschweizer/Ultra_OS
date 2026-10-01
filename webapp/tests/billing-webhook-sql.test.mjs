import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import Stripe from 'stripe';
import { Readable } from 'node:stream';
import { createBillingWebhookHandler } from '../pages/api/billing/webhook.js';
const migration = readFileSync(new URL('../supabase/migrations/20261001231152_billing_webhook_reconciliation.sql', import.meta.url), 'utf8');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
async function db() {
  const pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.athletes(id uuid primary key, stripe_customer_id text unique, stripe_subscription_id text,
    stripe_price_id text, stripe_subscription_status text, subscription_tier text not null default 'free', subscription_activated_at timestamptz);
    grant select, update on public.athletes to service_role;
    insert into public.athletes(id,stripe_customer_id) values('${owner}','cus_1'),('${other}','cus_2');`);
  await pg.exec(migration);
  return pg;
}
async function claim(pg, event = 'evt_1', customer = 'cus_1') {
  return (await pg.query('select public.claim_billing_webhook($1,$2,$3) as claim', [event,customer,'customer.subscription.updated'])).rows[0].claim;
}
const snapshot = { subscription_id: 'sub_new', price_id: 'price_1', status: 'active', tier: 'individual', activated_at: '2026-10-01T00:00:00Z' };
async function finish(pg, lease, athlete = owner, event = 'evt_1') {
  return pg.query('select public.finish_billing_webhook($1,$2,$3,$4,$5)', [event,'cus_1',lease.lease_token,athlete,JSON.stringify(snapshot)]);
}
test('real PostgreSQL: durable duplicate receipt, exclusive customer lease, atomic entitlement write', async () => {
  const pg = await db();
  try {
    const lease = await claim(pg); assert.ok(lease.lease_token);
    assert.deepEqual(await claim(pg, 'evt_2'), { busy: true });
    await finish(pg, lease); assert.deepEqual(await claim(pg), { duplicate: true });
    assert.equal((await pg.query('select subscription_tier from athletes where id=$1',[owner])).rows[0].subscription_tier, 'individual');
    assert.ok((await claim(pg,'evt_2')).lease_token);
  } finally { await pg.close(); }
});
test('real PostgreSQL: foreign-owner finish rolls back receipt and entitlement, then can retry', async () => {
  const pg = await db(); try {
    const lease = await claim(pg); await assert.rejects(finish(pg, lease, other), /ownership changed/);
    assert.equal((await pg.query('select processed_at from billing_private.webhook_receipts where event_id=$1',['evt_1'])).rows[0].processed_at, null);
    assert.equal((await pg.query('select subscription_tier from athletes where id=$1',[other])).rows[0].subscription_tier, 'free');
    await finish(pg, lease);
  } finally { await pg.close(); }
});
test('real PostgreSQL: expired worker cannot overwrite a reclaimed lease', async () => {
  const pg = await db(); try {
    const stale = await claim(pg); await pg.exec("update billing_private.customer_leases set expires_at = now() - interval '1 second'");
    const fresh = await claim(pg); assert.notEqual(stale.lease_token, fresh.lease_token);
    await assert.rejects(finish(pg, stale), /lease expired/); await finish(pg, fresh);
  } finally { await pg.close(); }
});
test('real PostgreSQL: release after processing failure allows immediate retry', async () => {
  const pg = await db(); try {
    const lease = await claim(pg); await pg.query('select release_billing_webhook($1,$2)', ['cus_1',lease.lease_token]);
    assert.ok((await claim(pg)).lease_token);
  } finally { await pg.close(); }
});

test('real PostgreSQL: missing/unknown tier cannot erase entitlement or acknowledge a receipt', async () => {
  const pg = await db(); try {
    const lease = await claim(pg);
    for (const tier of [null, 'unknown_paid_tier']) {
      await assert.rejects(pg.query('select public.finish_billing_webhook($1,$2,$3,$4,$5)',
        ['evt_1', 'cus_1', lease.lease_token, owner, JSON.stringify({ ...snapshot, tier })]), /Invalid subscription tier/);
      assert.equal((await pg.query('select processed_at from billing_private.webhook_receipts where event_id=$1', ['evt_1'])).rows[0].processed_at, null);
      assert.equal((await pg.query('select subscription_tier from public.athletes where id=$1', [owner])).rows[0].subscription_tier, 'free');
    }
    await finish(pg, lease);
  } finally { await pg.close(); }
});
test('real PostgreSQL: anon/authenticated cannot execute billing RPCs or read receipts; service role can', async () => {
  const pg = await db(); try {
    for (const role of ['anon','authenticated']) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(claim(pg), /permission denied/);
      await assert.rejects(pg.query('select * from billing_private.webhook_receipts'), /permission denied/);
      await pg.exec('reset role');
    }
    await pg.exec('set role service_role'); const lease = await claim(pg); await finish(pg,lease);
  } finally { await pg.close(); }
});
test('real PostgreSQL: migration rerun preserves processed receipts and security', async () => {
  const pg = await db(); try {
    const lease = await claim(pg); await finish(pg,lease); await pg.exec(migration);
    assert.deepEqual(await claim(pg),{ duplicate: true });
  } finally { await pg.close(); }
});

test('signed webhook integrates with real PostgreSQL receipts, current-state updates and lease retry', async () => {
  const pg = await db();
  try {
    process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY = 'price_1';
    const secret = 'whsec_postgres_integration';
    const stripe = new Stripe('sk_test_isolated_fixture');
    let providerReads = 0;
    let current = { id: 'sub_current', customer: 'cus_1', status: 'active', created: 1800000000,
      metadata: { athlete_id: owner }, items: { data: [{ price: { id: 'price_1' } }] } };
    stripe.subscriptions.list = async () => { providerReads++; return { data: [current] }; };
    const admin = {
      async rpc(name, args) {
        const columns = Object.keys(args); const values = Object.values(args);
        try {
          const result = await pg.query(`select public.${name}(${columns.map((column, i) => `${column} => $${i + 1}`).join(',')}) as value`, values);
          return { data: result.rows[0].value };
        } catch (error) { return { error }; }
      },
      from() {
        return { select() { return this; }, eq(column, value) { this.column = column; this.value = value; return this; },
          async maybeSingle() {
            const result = await pg.query(`select id, stripe_customer_id from public.athletes where ${this.column}=$1`, [this.value]);
            return { data: result.rows[0] || null };
          } };
      },
    };
    const handler = createBillingWebhookHandler({ getStripe: () => stripe, getClient: () => admin, secret: () => secret });
    async function deliver(eventId) {
      // The signed historical event says canceled; only CURRENT provider state may win.
      const payload = JSON.stringify({ id: eventId, type: 'customer.subscription.deleted',
        data: { object: { customer: 'cus_1', status: 'canceled' } } });
      const request = Readable.from([Buffer.from(payload)]);
      request.method = 'POST'; request.headers = { 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret }) };
      const response = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await handler(request, response); return response;
    }
    assert.equal((await deliver('evt_signed_1')).statusCode, 200);
    assert.equal((await pg.query('select subscription_tier from public.athletes where id=$1', [owner])).rows[0].subscription_tier, 'individual');
    assert.equal((await deliver('evt_signed_1')).body.duplicate, true); assert.equal(providerReads, 1);
    current = { ...current, status: 'canceled' };
    const held = await claim(pg, 'evt_held');
    assert.equal((await deliver('evt_signed_2')).statusCode, 503); assert.equal(providerReads, 1);
    await pg.query('select public.release_billing_webhook($1,$2)', ['cus_1', held.lease_token]);
    assert.equal((await deliver('evt_signed_2')).statusCode, 200);
    assert.equal((await pg.query('select subscription_tier from public.athletes where id=$1', [owner])).rows[0].subscription_tier, 'free');
    assert.equal((await pg.query('select count(*)::int as count from billing_private.webhook_receipts where processed_at is not null')).rows[0].count, 2);
  } finally { await pg.close(); }
});
