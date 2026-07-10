import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || 'test-session-secret';

import deleteAccountHandler, { ORPHAN_DELETIONS } from '../pages/api/delete-account.js';
import { signAthleteId } from '../lib/auth/sessionCookies.js';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

function makeRes() {
  const headers = new Map();
  return {
    statusCode: null,
    body: null,
    getHeader: (k) => headers.get(k),
    setHeader: (k, v) => headers.set(k, v),
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('rejects non-DELETE methods', async () => {
  const res = makeRes();
  await deleteAccountHandler({ method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

test('rejects unauthenticated requests', async () => {
  const res = makeRes();
  await deleteAccountHandler({ method: 'DELETE', headers: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('rejects a forged unsigned athlete_id cookie', async () => {
  const res = makeRes();
  await deleteAccountHandler(
    { method: 'DELETE', headers: { cookie: `athlete_id=${UUID}` }, body: { confirm: 'DELETE MY ACCOUNT' } },
    res
  );
  assert.equal(res.statusCode, 401);
});

test('rejects wrong confirmation text before touching the database', async () => {
  const res = makeRes();
  await deleteAccountHandler(
    {
      method: 'DELETE',
      headers: { cookie: `athlete_id=${signAthleteId(UUID)}` },
      body: { confirm: 'delete my account' },
    },
    res
  );
  assert.equal(res.statusCode, 400);
});

test('orphan deletion list covers the non-cascading tables', () => {
  const tables = ORPHAN_DELETIONS.map(([table]) => table);
  // FK is ON DELETE SET NULL for these — rows would survive the athlete
  // row deletion as orphans unless deleted explicitly.
  for (const required of ['attachments', 'coros_activities', 'integration_interest']) {
    assert.ok(tables.includes(required), `missing orphan cleanup for ${required}`);
  }
  // attachments is keyed by owner_athlete_id, not athlete_id.
  const attachments = ORPHAN_DELETIONS.find(([table]) => table === 'attachments');
  assert.equal(attachments[1], 'owner_athlete_id');
});
