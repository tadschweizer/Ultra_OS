import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchAdminHandler } from '../pages/api/research-library/admin.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { AUTH_COOKIE_NAME } from '../lib/auth/contracts.js';

process.env.SESSION_COOKIE_SECRET = 'research-admin-regression-secret-at-least-32-characters';
const id = '11111111-1111-4111-8111-111111111111';
function response() {
  return { code: null, body: null, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, end() { return this; } };
}
function harness({ signedIn = true, isAdmin = false, lookupError = false, role = 'athlete' } = {}) {
  const operations = [];
  const entry = { id: 'entry-1', title: 'Study', pubmed_url: 'https://pubmed.ncbi.nlm.nih.gov/1/' };
  const client = { from(table) {
    if (table === 'athletes') return {
      select() { return this; }, eq(column, value) { assert.equal(value, id); return this; },
      async maybeSingle() { return { data: { is_admin: isAdmin, primary_role: role, subscription_tier: role === 'coach' ? 'coach' : 'free' }, error: lookupError ? { message: 'unavailable' } : null }; },
    };
    assert.equal(table, 'research_library_entries');
    operations.push('research');
    let mutation;
    const q = {
      select() { return this; }, order() { return this; }, eq() { return this; },
      insert(payload) { mutation = 'insert'; operations.push(mutation); assert.equal(payload.title, 'Study'); return this; },
      update(payload) { mutation = 'update'; operations.push(mutation); assert.equal(payload.title, 'Study'); return this; },
      delete() { mutation = 'delete'; operations.push(mutation); return this; },
      async single() { return { data: entry, error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: mutation ? entry : [entry], error: null }).then(resolve, reject); },
    };
    return q;
  } };
  return { operations, entry, handler: createResearchAdminHandler({ getClient: () => client }),
    req(method) { return { method, headers: { cookie: signedIn ? `${AUTH_COOKIE_NAME}=${signAthleteSession(id)}` : '' },
      query: { id: entry.id }, body: { ...entry, is_admin: true, role: 'admin' } }; } };
}
for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
  for (const role of ['anonymous', 'athlete', 'coach']) {
    test(`${method}: ${role} denied before any privileged research access`, async () => {
      const h = harness({ signedIn: role !== 'anonymous', role });
      const res = response();
      await h.handler(h.req(method), res);
      assert.equal(res.code, role === 'anonymous' ? 401 : 403);
      assert.deepEqual(h.operations, []);
    });
  }
  test(`${method}: canonical administrator preserves legitimate operation`, async () => {
    const h = harness({ isAdmin: true });
    const res = response();
    await h.handler(h.req(method), res);
    assert.equal(res.code, 200);
    assert.deepEqual(h.operations, method === 'GET' ? ['research'] : ['research', { POST: 'insert', PUT: 'update', DELETE: 'delete' }[method]]);
    assert.deepEqual(res.body, method === 'GET' ? { entries: [h.entry] } : method === 'DELETE' ? { success: true } : { entry: h.entry });
  });
  test(`${method}: administrator lookup failure denies research access`, async () => {
    const h = harness({ isAdmin: true, lookupError: true });
    const res = response();
    await h.handler(h.req(method), res);
    assert.equal(res.code, 500);
    assert.deepEqual(h.operations, []);
  });
}
