import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { handleCoachInvitation } from '../pages/api/coach/accept-invitation.js';
import { sendCoachInvitationEmail } from '../lib/email/transactional.js';
import { isCoachInvitationPath, safeNextPath } from '../lib/auth/redirects.js';

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function makeAdmin(seed) {
  const tables = structuredClone(seed);

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = 'select';
      this.payload = null;
    }
    select() { return this; }
    eq(field, value) { this.filters.push([field, value]); return this; }
    update(payload) { this.operation = 'update'; this.payload = payload; return this; }
    async insert(payload) {
      const rows = Array.isArray(payload) ? payload : [payload];
      tables[this.table].push(...structuredClone(rows));
      return { data: rows, error: null };
    }
    async upsert(payload) {
      const rows = tables[this.table];
      const index = rows.findIndex((row) => row.coach_id === payload.coach_id && row.athlete_id === payload.athlete_id);
      if (index >= 0) rows[index] = { ...rows[index], ...structuredClone(payload) };
      else rows.push({ id: `${this.table}-${rows.length + 1}`, ...structuredClone(payload) });
      return { data: payload, error: null };
    }
    matchingRows() {
      return tables[this.table].filter((row) => this.filters.every(([field, value]) => row[field] === value));
    }
    async maybeSingle() {
      const rows = this.matchingRows();
      if (this.operation === 'update') rows.forEach((row) => Object.assign(row, structuredClone(this.payload)));
      return { data: rows[0] || null, error: null };
    }
    async execute() {
      const rows = this.matchingRows();
      if (this.operation === 'update') rows.forEach((row) => Object.assign(row, structuredClone(this.payload)));
      return { data: rows, error: null };
    }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
  }

  return {
    tables,
    from(table) {
      if (!tables[table]) tables[table] = [];
      return new Query(table);
    },
  };
}

function pendingSeed(overrides = {}) {
  return {
    coach_invitations: [{
      id: 'invite-1', coach_id: 'coach-1', email: 'athlete@example.com', token: 'token-1',
      status: 'pending', expires_at: '2026-08-22T12:00:00.000Z', accepted_at: null,
      ...overrides,
    }],
    coach_profiles: [{ id: 'coach-1', athlete_id: 'coach-athlete', display_name: 'Coach Casey' }],
    athletes: [{ id: 'athlete-1', email: 'athlete@example.com' }],
    coach_athlete_relationships: [],
    coach_athlete_links: [],
  };
}

const fixedNow = new Date('2026-08-20T12:00:00.000Z');
const loggedInAsAthlete = async () => 'athlete-1';
const effectiveAthlete = async () => ({ athleteId: 'athlete-1' });

test('canonical invitation return paths survive auth without opening an external redirect', () => {
  const invitationPath = '/join?coach_invite=token-1';
  assert.equal(safeNextPath(invitationPath), invitationPath);
  assert.equal(isCoachInvitationPath(invitationPath), true);
  assert.equal(isCoachInvitationPath('//evil.example/join?coach_invite=token-1'), false);
  assert.equal(safeNextPath('https://evil.example/join?coach_invite=token-1'), '/dashboard');
});

test('coach invitation API previews invalid, expired, used, and already-accepted states', async () => {
  const cases = [
    { seed: pendingSeed({ token: 'different' }), status: 404, code: 'invalid' },
    { seed: pendingSeed({ expires_at: '2026-08-19T12:00:00.000Z' }), status: 410, code: 'expired' },
    { seed: pendingSeed({ status: 'revoked' }), status: 409, code: 'used' },
    {
      seed: {
        ...pendingSeed({ status: 'accepted' }),
        coach_athlete_relationships: [{ id: 'rel-1', coach_id: 'coach-1', athlete_id: 'athlete-1', status: 'active' }],
      },
      status: 409,
      code: 'already_accepted',
    },
  ];

  for (const scenario of cases) {
    const res = makeRes();
    await handleCoachInvitation({ method: 'GET', query: { token: 'token-1' } }, res, {
      admin: makeAdmin(scenario.seed),
      effectiveAthleteResolver: effectiveAthlete,
      now: fixedNow,
    });
    assert.equal(res.statusCode, scenario.status);
    assert.equal(res.body.code, scenario.code);
  }
});

test('accepting an invitation activates the coach roster, athlete coach list, and invitation', async () => {
  const admin = makeAdmin(pendingSeed());
  const res = makeRes();
  await handleCoachInvitation({ method: 'POST', body: { token: 'token-1' } }, res, {
    admin,
    liveAthleteResolver: loggedInAsAthlete,
    now: fixedNow,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.coach.display_name, 'Coach Casey');
  assert.deepEqual(
    admin.tables.coach_athlete_relationships.map(({ coach_id, athlete_id, status, initiated_by }) => ({ coach_id, athlete_id, status, initiated_by })),
    [{ coach_id: 'coach-1', athlete_id: 'athlete-1', status: 'active', initiated_by: 'coach' }]
  );
  assert.deepEqual(
    admin.tables.coach_athlete_links.map(({ coach_id, athlete_id, role, status }) => ({ coach_id, athlete_id, role, status })),
    [{ coach_id: 'coach-1', athlete_id: 'athlete-1', role: 'primary', status: 'active' }]
  );
  assert.equal(admin.tables.coach_invitations[0].status, 'accepted');
  assert.equal(admin.tables.coach_invitations[0].accepted_at, fixedNow.toISOString());
});

test('invitation acceptance rejects the wrong signed-in account without creating a relationship', async () => {
  const admin = makeAdmin(pendingSeed());
  admin.tables.athletes[0].email = 'someone-else@example.com';
  const res = makeRes();
  await handleCoachInvitation({ method: 'POST', body: { token: 'token-1' } }, res, {
    admin,
    liveAthleteResolver: loggedInAsAthlete,
    now: fixedNow,
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'wrong_account');
  assert.equal(admin.tables.coach_athlete_relationships.length, 0);
  assert.equal(admin.tables.coach_athlete_links.length, 0);
});

test('coach invitation email contains coach identity, purpose, expiry, and canonical URL', async () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFetch = global.fetch;
  process.env.RESEND_API_KEY = 'test-key';
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true };
  };

  try {
    const result = await sendCoachInvitationEmail({
      coachName: 'Coach Casey',
      email: 'athlete@example.com',
      inviteUrl: 'https://mythreshold.co/join?coach_invite=token-1',
      expiresAt: '2026-08-22T12:00:00.000Z',
    });
    assert.equal(result.ok, true);
    assert.match(requestBody.subject, /Coach Casey/);
    assert.match(requestBody.html, /connect your Threshold athlete account/);
    assert.match(requestBody.html, /August 22, 2026/);
    assert.match(requestBody.html, /join\?coach_invite=token-1/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey) process.env.RESEND_API_KEY = originalKey;
    else delete process.env.RESEND_API_KEY;
  }
});

test('missing email configuration is distinguishable from a delivered invitation', async () => {
  const originalKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const result = await sendCoachInvitationEmail({
      coachName: 'Coach Casey',
      email: 'athlete@example.com',
      inviteUrl: 'https://mythreshold.co/join?coach_invite=token-1',
      expiresAt: '2026-08-22T12:00:00.000Z',
    });
    assert.deepEqual(result, { ok: true, skipped: true });
  } finally {
    if (originalKey) process.env.RESEND_API_KEY = originalKey;
  }
});

test('Command Center keeps an explicit one-click copy fallback and honest delivery copy', () => {
  const commandCenter = fs.readFileSync(new URL('../pages/coach-command-center.js', import.meta.url), 'utf8');
  const invitationRoute = fs.readFileSync(new URL('../pages/api/coach/invitations.js', import.meta.url), 'utf8');
  assert.match(commandCenter, /navigator\.clipboard\.writeText/);
  assert.match(commandCenter, /Invitation email sent\./);
  assert.match(invitationRoute, /delivery_status: 'failed'/);
  assert.match(invitationRoute, /Invitation created, but (?:email delivery is not configured|the email could not be delivered)/);
});
