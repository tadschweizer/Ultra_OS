import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { handleCoachInvitation } from '../pages/api/coach/accept-invitation.js';
import { handleCoachInvitations } from '../pages/api/coach/invitations.js';
import { sendCoachInvitationEmail } from '../lib/email/transactional.js';
import { isCoachInvitationPath, safeNextPath } from '../lib/auth/redirects.js';

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; },
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
    order() { return this; }
    eq(field, value) { this.filters.push([field, value]); return this; }
    update(payload) { this.operation = 'update'; this.payload = payload; return this; }
    insert(payload) {
      this.operation = 'insert';
      this.payload = payload;
      return this;
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
      const result = await this.execute();
      return { data: result.data?.[0] || null, error: result.error };
    }
    async single() {
      const result = await this.execute();
      return { data: result.data?.[0] || null, error: result.error };
    }
    async execute() {
      if (this.operation === 'insert') {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted = payloads.map((payload, index) => ({
          id: payload.id || `${this.table}-${tables[this.table].length + index + 1}`,
          created_at: payload.created_at || fixedNow.toISOString(),
          ...structuredClone(payload),
        }));
        tables[this.table].push(...inserted);
        return { data: inserted, error: null };
      }
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
      delivery_status: 'sent', delivery_attempted_at: '2026-08-20T11:59:00.000Z',
      delivery_sent_at: '2026-08-20T11:59:00.000Z', delivery_failure_category: null,
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
const coachAthleteResolver = async () => 'coach-athlete';

function coachInvitationSeed() {
  return {
    athletes: [{ id: 'coach-athlete', name: 'Coach Casey' }],
    coach_profiles: [{
      id: 'coach-1', athlete_id: 'coach-athlete', display_name: 'Coach Casey', coach_code: 'CASEY-1',
    }],
    coach_invitations: [],
  };
}

async function createCoachInvitation(admin, emailSender) {
  const res = makeRes();
  await handleCoachInvitations({ method: 'POST', body: { email: 'ATHLETE@example.com' } }, res, {
    admin,
    athleteIdResolver: coachAthleteResolver,
    emailSender,
    siteUrl: 'https://mythreshold.co/',
    now: fixedNow,
    tokenGenerator: () => 'token-created',
  });
  return res;
}

async function listCoachInvitations(admin) {
  const res = makeRes();
  await handleCoachInvitations({ method: 'GET' }, res, {
    admin,
    athleteIdResolver: coachAthleteResolver,
    now: fixedNow,
  });
  return res;
}

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
  assert.equal(admin.tables.coach_invitations[0].delivery_status, 'sent');
  assert.equal(admin.tables.coach_invitations[0].delivery_sent_at, '2026-08-20T11:59:00.000Z');
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

test('provider rejection returns only a safe delivery failure category', async () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  process.env.RESEND_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: false, status: 503 });
  console.error = () => {};

  try {
    const result = await sendCoachInvitationEmail({
      coachName: 'Coach Casey',
      email: 'athlete@example.com',
      inviteUrl: 'https://mythreshold.co/join?coach_invite=token-1',
      expiresAt: '2026-08-22T12:00:00.000Z',
    });
    assert.deepEqual(result, { ok: false, failureCategory: 'provider_unavailable' });
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalKey) process.env.RESEND_API_KEY = originalKey;
    else delete process.env.RESEND_API_KEY;
  }
});

test('successful invitation delivery is persisted and survives a GET refresh', async () => {
  const admin = makeAdmin(coachInvitationSeed());
  const postRes = await createCoachInvitation(admin, async () => ({ ok: true }));

  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.body.delivery_status, 'sent');
  assert.equal(postRes.body.invitation.status, 'pending');
  assert.equal(postRes.body.invitation.delivery_status, 'sent');
  assert.equal(postRes.body.invitation.delivery_attempted_at, fixedNow.toISOString());
  assert.equal(postRes.body.invitation.delivery_sent_at, fixedNow.toISOString());
  assert.equal(postRes.body.invitation.delivery_failure_category, null);
  assert.equal(postRes.body.invite_url, 'https://mythreshold.co/join?coach_invite=token-created');

  const getRes = await listCoachInvitations(admin);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.invitations[0].delivery_status, 'sent');
  assert.equal(getRes.body.invitations[0].delivery_sent_at, fixedNow.toISOString());
});

test('provider failure is persisted, survives refresh, and stays separate from revocation', async () => {
  const admin = makeAdmin(coachInvitationSeed());
  const postRes = await createCoachInvitation(admin, async () => ({
    ok: false,
    failureCategory: 'provider_rejected',
  }));

  assert.equal(postRes.statusCode, 502);
  assert.equal(postRes.body.delivery_status, 'failed');
  assert.equal(postRes.body.invitation.status, 'pending');
  assert.equal(postRes.body.invitation.delivery_status, 'failed');
  assert.equal(postRes.body.invitation.delivery_failure_category, 'provider_rejected');
  assert.match(postRes.body.error, /Copy the invitation link instead/);

  const getRes = await listCoachInvitations(admin);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.invitations[0].delivery_status, 'failed');
  assert.equal(getRes.body.invitations[0].delivery_failure_category, 'provider_rejected');

  const revokeRes = makeRes();
  await handleCoachInvitations({
    method: 'PATCH',
    body: { id: postRes.body.invitation.id, status: 'revoked' },
  }, revokeRes, {
    admin,
    athleteIdResolver: coachAthleteResolver,
    now: fixedNow,
  });
  assert.equal(revokeRes.statusCode, 200);
  assert.equal(revokeRes.body.invitation.status, 'revoked');
  assert.equal(revokeRes.body.invitation.delivery_status, 'failed');
});

test('unconfigured email delivery is persisted as skipped and survives a GET refresh', async () => {
  const admin = makeAdmin(coachInvitationSeed());
  const postRes = await createCoachInvitation(admin, async () => ({ ok: true, skipped: true }));

  assert.equal(postRes.statusCode, 502);
  assert.equal(postRes.body.delivery_status, 'skipped');
  assert.equal(postRes.body.invitation.status, 'pending');
  assert.equal(postRes.body.invitation.delivery_status, 'skipped');
  assert.equal(postRes.body.invitation.delivery_failure_category, 'not_configured');
  assert.equal(postRes.body.invitation.delivery_sent_at, null);

  const getRes = await listCoachInvitations(admin);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.invitations[0].delivery_status, 'skipped');
  assert.equal(getRes.body.invitations[0].delivery_failure_category, 'not_configured');
});

test('Command Center keeps an explicit one-click copy fallback and honest delivery copy', () => {
  const commandCenter = fs.readFileSync(new URL('../pages/coach-command-center.js', import.meta.url), 'utf8');
  const invitationRoute = fs.readFileSync(new URL('../pages/api/coach/invitations.js', import.meta.url), 'utf8');
  assert.match(commandCenter, /navigator\.clipboard\.writeText/);
  assert.match(commandCenter, /Invitation email sent\./);
  assert.match(commandCenter, /Email failed/);
  assert.match(commandCenter, /Email not configured/);
  assert.match(commandCenter, /Delivery not recorded/);
  assert.match(invitationRoute, /delivery_status: 'failed'/);
  assert.match(invitationRoute, /delivery_status: 'skipped'/);
  assert.match(invitationRoute, /Invitation created, but (?:email delivery is not configured|the email could not be delivered)/);
});
