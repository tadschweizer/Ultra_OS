import test from 'node:test';
import assert from 'node:assert/strict';
import { createBillingFlowHandler } from '../lib/billingFlow.js';
import { createBillingSyncHandler } from '../pages/api/billing/sync.js';
import { getTierFromSubscription } from '../lib/billingPlans.js';

process.env.SESSION_COOKIE_SECRET = 'billing-tests-secret-at-least-32-characters';
process.env.NEXT_PUBLIC_SITE_URL = 'https://threshold.example';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_month';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_year';
process.env.STRIPE_PRICE_CORE_MONTHLY = 'price_core';
const fixedNow = 1800000000000;
function response() {
  return { code: null, body: null, headers: {}, setHeader(k,v) { this.headers[k] = v; },
    getHeader(k) { return this.headers[k]; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
    redirect(code, url) { this.code = code; this.body = { url }; return this; } };
}
function price(id = 'price_year') { return { id, active: true, type: 'recurring', unit_amount: id === 'price_year' ? 14400 : 1500,
  currency: 'usd', recurring: { interval: id === 'price_year' ? 'year' : 'month', interval_count: 1, usage_type: 'licensed' } }; }
function subscription(priceId = 'price_month', status = 'active') { return { id: 'sub_1', customer: 'cus_1', status,
  created: 1750000000, metadata: { athlete_id: 'athlete-1', subscription_tier: 'pro' },
  items: { data: [{ id: 'item_1', quantity: 1, price: price(priceId) }] } }; }
function harness({ existing = false, signedIn = true } = {}) {
  const calls = [];
  const account = { id: 'athlete-1', email: 'athlete@example.test', stripe_customer_id: 'cus_1', stripe_subscription_id: existing ? 'sub_1' : null };
  const state = { sub: existing ? subscription() : null, price: price(), open: [], dbError: null, fail: null, now: fixedNow };
  const client = { async rpc(name, args) {
    if (name === 'claim_billing_webhook') return { data: { lease_token: 'lease_1' }, error: null };
    if (name === 'finish_billing_webhook') {
      const snapshot = args.p_snapshot;
      const values = { subscription_tier: snapshot.tier, stripe_subscription_status: snapshot.status };
      calls.push(['write', values]);
      if (!state.dbError) Object.assign(account, values);
    }
    return { data: null, error: state.dbError };
  }, from() { return { update(values) { calls.push(['write', values]); if (!state.dbError) Object.assign(account, values); return this; },
    select() { return this; }, eq() { return this; }, is() { return this; },
    async single() { return { data: account, error: state.dbError }; },
    async maybeSingle() { return { data: account, error: state.dbError }; } }; } };
  const stripe = {
    prices: { async retrieve() { calls.push(['price']); return state.price; } },
    customers: { async create(params, options) { calls.push(['customer', params, options]); return { id: 'cus_1' }; } },
    subscriptions: { async list() { calls.push(['subscriptions']); return { data: state.sub ? [state.sub] : [] }; },
      async retrieve() { calls.push(['subscription']); return state.sub; },
      async update() { throw new Error('Direct subscription mutation forbidden'); } },
    checkout: { sessions: { async list() { return { data: state.open }; },
      async listLineItems() { return { data: [{ price: state.price, quantity: 1 }] }; },
      async create(params, options) { calls.push(['checkout', params, options]); if (state.fail) throw state.fail;
        return { id: 'cs_1', url: 'https://checkout.stripe.com/test' }; },
      async retrieve() { return state.session; } } },
    billingPortal: { sessions: { async create(params, options) { calls.push(['portal', params, options]); if (state.fail) throw state.fail;
      return { url: 'https://billing.stripe.com/test' }; } } },
  };
  const deps = { getClient: () => client, getAthlete: async () => signedIn ? account : null, getStripe: () => stripe, now: () => state.now };
  const req = (method = 'POST', body = {}) => ({ method, body, query: { plan: 'pro_annual' }, headers: {
    origin: 'https://threshold.example', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' } });
  const run = async (action, request) => { const res = response(); await createBillingFlowHandler(action, deps)(request, res); return res; };
  const preview = () => run('preview', req('GET'));
  const submit = intent => run('checkout', req('POST', { plan: 'pro_annual', intent }));
  const sync = async request => { const res = response(); await createBillingSyncHandler(deps)(request, res); return res; };
  return { calls, state, account, req, run, preview, submit, sync };
}

test('legacy checkout GET is a read-only redirect with no auth, Stripe, or database calls', async () => {
  const h = harness(); const res = await h.run('checkout', h.req('GET'));
  assert.equal(res.code, 303); assert.equal(res.body.url, '/billing/checkout?plan=pro_annual'); assert.deepEqual(h.calls, []);
});
for (const action of ['checkout', 'portal']) {
  for (const [name, headers, code] of [
    ['cross origin', { origin: 'https://attacker.example' }, 403], ['missing origin', { origin: undefined }, 403],
    ['null origin', { origin: 'null' }, 403], ['cross-site fetch', { 'sec-fetch-site': 'cross-site' }, 403],
    ['form post', { 'content-type': 'application/x-www-form-urlencoded' }, 415],
  ]) test(`${action}: rejects ${name} before billing access`, async () => {
    const h = harness(); const req = h.req(); Object.assign(req.headers, headers);
    req.headers['x-forwarded-host'] = 'attacker.example';
    const res = await h.run(action, req); assert.equal(res.code, code); assert.deepEqual(h.calls, []);
  });
  test(`${action}: unsupported method rejected before Stripe access`, async () => {
    const h = harness(); const res = await h.run(action, h.req('DELETE')); assert.equal(res.code, 405); assert.deepEqual(h.calls, []);
  });
  test(`${action}: unauthenticated request rejected`, async () => {
    const h = harness({ signedIn: false }); const res = await h.run(action, h.req('POST', { plan: 'pro_annual' })); assert.equal(res.code, 401);
  });
}
test('coach plan remains unavailable before authentication and Stripe calls', async () => {
  for (const plan of ['coach_monthly', 'coach_essentials_monthly', 'coach_pro_annual', 'individual_annual', 'research_monthly']) {
    const h = harness(); const res = await h.run('checkout', h.req('POST', { plan })); assert.equal(res.code, 403); assert.deepEqual(h.calls, []);
  }
});
for (const [name, from, to, plan] of [['Core to Pro upgrade', 'price_core', 'price_year', 'pro_annual'], ['Pro to Core downgrade', 'price_year', 'price_core', 'core_monthly']]) {
  test(`${name} requires hosted confirmation without changing the saved tier`, async () => {
    const h = harness({ existing: true }); h.state.sub = subscription(from); h.state.price = price(to);
    const request = h.req('GET'); request.query.plan = plan;
    const review = await h.run('preview', request); assert.equal(review.code, 200);
    const result = await h.run('checkout', h.req('POST', { plan, intent: review.body.intent })); assert.equal(result.code, 200);
    assert.equal(h.calls.find(call => call[0] === 'portal')[1].flow_data.subscription_update_confirm.items[0].price, to);
    assert.equal(h.calls.some(call => call[0] === 'write'), false);
  });
}
test('preview shows server price and never creates sessions or writes entitlement', async () => {
  const h = harness({ existing: true }); const res = await h.preview(); assert.equal(res.code, 200);
  assert.equal(res.body.price.amount, 14400); assert.equal(res.body.currentPrice.amount, 1500);
  assert.equal(res.body.changing, true); assert.deepEqual(h.calls.map(c => c[0]), ['price', 'subscriptions']);
});
for (const [name, from, to] of [['upgrade', 'price_month', 'price_year'], ['downgrade', 'price_year', 'price_month']]) {
  test(`${name} opens explicit hosted confirmation; no subscription mutation or tier write`, async () => {
    const h = harness({ existing: true }); h.state.sub = subscription(from); h.state.price = price(to);
    const plan = to === 'price_year' ? 'pro_annual' : 'pro_monthly';
    const req = h.req('GET'); req.query.plan = plan;
    const review = await h.run('preview', req);
    const res = await h.run('checkout', h.req('POST', { plan, intent: review.body.intent }));
    assert.equal(res.code, 200); const flow = h.calls.find(c => c[0] === 'portal')[1].flow_data;
    assert.equal(flow.type, 'subscription_update_confirm'); assert.equal(flow.subscription_update_confirm.items[0].price, to);
    assert.equal(h.calls.some(c => c[0] === 'write' || c[0] === 'checkout'), false);
  });
}
test('repeat submission of one review reuses the Stripe idempotency key and parameters', async () => {
  const h = harness(); const review = await h.preview(); await h.submit(review.body.intent); await h.submit(review.body.intent);
  const calls = h.calls.filter(c => c[0] === 'checkout'); assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]);
});
test('same plan opens management without a plan-change flow', async () => {
  const h = harness({ existing: true }); h.state.sub = subscription('price_year');
  const review = await h.preview(); assert.equal(review.body.samePlan, true); await h.submit(review.body.intent);
  assert.equal(h.calls.find(c => c[0] === 'portal')[1].flow_data, undefined);
});
for (const kind of ['tampered', 'expired', 'other account', 'price changed', 'subscription changed']) {
  test(`${kind} review cannot start billing`, async () => {
    const h = harness(); const review = await h.preview(); let intent = review.body.intent;
    if (kind === 'tampered') intent += 'x';
    if (kind === 'expired') h.state.now += 16 * 60 * 1000;
    if (kind === 'other account') h.account.id = 'athlete-2';
    if (kind === 'price changed') h.state.price.unit_amount++;
    if (kind === 'subscription changed') h.state.sub = subscription();
    const res = await h.submit(intent); assert.equal(res.code, 409); assert.equal(h.calls.some(c => ['checkout', 'portal', 'write'].includes(c[0])), false);
  });
}
test('failed provider call is sanitized and cannot grant paid access', async () => {
  const h = harness({ existing: true }); const review = await h.preview();
  h.state.fail = new Error('secret provider detail sk_live_123'); const res = await h.submit(review.body.intent);
  assert.equal(res.code, 503); assert.equal(JSON.stringify(res.body).includes('sk_live'), false); assert.equal(h.calls.some(c => c[0] === 'write'), false);
});
test('unfinished checkout is reused rather than creating another', async () => {
  const h = harness(); const review = await h.preview(); h.state.open = [{ mode: 'subscription', metadata: { athlete_id: h.account.id, billing_plan: 'pro_annual' }, url: 'https://checkout.stripe.com/original' }];
  const res = await h.submit(review.body.intent); assert.equal(res.body.url, h.state.open[0].url); assert.equal(h.calls.some(c => c[0] === 'checkout'), false);
});
test('customer is persisted before a new checkout and no customer is discovered by email', async () => {
  const h = harness(); h.account.stripe_customer_id = null; const review = await h.preview(); const res = await h.submit(review.body.intent);
  assert.equal(res.code, 200); assert.deepEqual(h.calls.filter(c => ['customer', 'write', 'checkout'].includes(c[0])).map(c => c[0]), ['customer', 'write', 'checkout']);
});
test('portal refuses missing linked customer instead of searching by email', async () => {
  const h = harness(); h.account.stripe_customer_id = null; const res = await h.run('portal', h.req()); assert.equal(res.code, 409); assert.deepEqual(h.calls, []);
});
test('sync cannot restore a logged-out session from pending cookies', async () => {
  const h = harness({ signedIn: false }); const req = h.req(); req.headers.cookie = 'pending_checkout_session_id=cs_1; pending_billing_state=anything';
  assert.equal((await h.sync(req)).code, 401); assert.deepEqual(h.calls, []);
});
for (const kind of ['missing owner', 'other owner', 'incomplete', 'unpaid', 'wrong customer', 'wrong subscription owner']) {
  test(`sync rejects ${kind} checkout before entitlement writes`, async () => {
    const h = harness({ existing: true }); h.state.session = { mode: 'subscription', status: 'complete', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', metadata: { athlete_id: h.account.id } };
    if (kind === 'missing owner') h.state.session.metadata = {};
    if (kind === 'other owner') h.state.session.metadata.athlete_id = 'other';
    if (kind === 'incomplete') h.state.session.status = 'open';
    if (kind === 'unpaid') h.state.session.payment_status = 'unpaid';
    if (kind === 'wrong customer') h.state.session.customer = 'cus_other';
    if (kind === 'wrong subscription owner') h.state.sub.metadata.athlete_id = 'other';
    const res = await h.sync(h.req('POST', { sessionId: 'cs_1' }));
    assert.equal(res.code, ['incomplete', 'unpaid'].includes(kind) ? 200 : 403); assert.equal(h.calls.some(c => c[0] === 'write'), false);
  });
}
test('sync writes verified current price, preserving past_due grace; stale metadata cannot select tier', async () => {
  const h = harness({ existing: true }); h.state.sub.status = 'past_due'; h.state.sub.metadata.subscription_tier = 'coach';
  const res = await h.sync(h.req()); assert.equal(res.code, 200); assert.equal(res.body.athlete.subscription_tier, 'pro');
  assert.equal(res.headers['Set-Cookie'].some(c => c.startsWith('athlete_id=')), false);
});
test('sync database failure is retryable and sanitized', async () => {
  const h = harness({ existing: true }); h.state.dbError = { message: 'database password' };
  const res = await h.sync(h.req()); assert.equal(res.code, 503); assert.equal(JSON.stringify(res.body).includes('password'), false);
});
test('unknown current price cannot gain access from arbitrary metadata', () => {
  const sub = subscription('unknown'); sub.metadata.subscription_tier = 'coach'; assert.equal(getTierFromSubscription(sub), 'free');
});
for (const [name, headers, code] of [
  ['cross origin', { origin: 'https://attacker.example' }, 403],
  ['missing origin', { origin: undefined }, 403],
  ['form content', { 'content-type': 'text/plain' }, 415],
]) test(`sync: ${name} rejected before any billing access`, async () => {
  const h = harness(); const req = h.req(); Object.assign(req.headers, headers);
  const res = await h.sync(req); assert.equal(res.code, code); assert.deepEqual(h.calls, []);
});
for (const status of ['incomplete', 'unpaid', 'paused']) test(`${status} subscription cannot accidentally start a second subscription`, async () => {
  const h = harness({ existing: true }); h.state.sub.status = status;
  const res = await h.preview(); assert.equal(res.code, 503); assert.equal(h.calls.some(c => ['checkout', 'portal', 'write'].includes(c[0])), false);
});
test('pending checkout for another plan cannot start a duplicate', async () => {
  const h = harness(); const review = await h.preview(); h.state.open = [{ mode: 'subscription', metadata: { athlete_id: h.account.id, billing_plan: 'pro_monthly' } }];
  const res = await h.submit(review.body.intent); assert.equal(res.code, 409); assert.equal(h.calls.some(c => c[0] === 'checkout'), false);
});
test('separate concurrent reviews in one window share the new-checkout key', async () => {
  const h = harness(); const a = await h.preview(); const b = await h.preview();
  assert.notEqual(a.body.intent, b.body.intent); await h.submit(a.body.intent); await h.submit(b.body.intent);
  const calls = h.calls.filter(c => c[0] === 'checkout'); assert.deepEqual(calls[0], calls[1]);
});
test('failed customer persistence stops checkout', async () => {
  const h = harness(); h.account.stripe_customer_id = null; const review = await h.preview();
  h.state.dbError = { message: 'private database detail' }; const res = await h.submit(review.body.intent);
  assert.equal(res.code, 503); assert.equal(h.calls.some(c => c[0] === 'checkout'), false);
});
test('multi-item or multi-quantity subscriptions fail closed', async () => {
  for (const multiItem of [true, false]) {
    const h = harness({ existing: true });
    if (multiItem) h.state.sub.items.data.push({ ...h.state.sub.items.data[0] });
    else h.state.sub.items.data[0].quantity = 2;
    assert.equal((await h.preview()).code, 503);
  }
});
test('return URLs use configured origin and ignore attacker-controlled forwarded hosts', async () => {
  const h = harness(); const review = await h.preview(); const req = h.req('POST', { plan: 'pro_annual', intent: review.body.intent });
  req.headers['x-forwarded-host'] = 'attacker.example'; req.headers['x-forwarded-proto'] = 'https';
  await h.run('checkout', req);
  const params = h.calls.find(c => c[0] === 'checkout')[1]; assert.match(params.success_url, /^https:\/\/threshold.example\//);
});
