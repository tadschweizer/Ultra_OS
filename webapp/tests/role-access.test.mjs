import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAccountAccess,
  hasRole,
  primaryRoleForSignupRole,
} from '../lib/auth/roleGuards.js';
import {
  normalizeSignupRoleIntent,
} from '../lib/auth/signupRoleIntent.js';
import roleIntentHandler from '../pages/api/auth/role-intent.js';
import {
  requireActiveCoachRelationship,
  requireCoachAccess,
} from '../lib/auth/roleAccessServer.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
import { AUTH_COOKIE_NAME } from '../lib/auth/contracts.js';
import {
  getMobileTabs,
  getSidebarSections,
} from '../lib/siteNavigation.js';

const root = fileURLToPath(new URL('..', import.meta.url));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function makeRes() {
  const headers = new Map();
  return {
    statusCode: null,
    body: null,
    getHeader(name) { return headers.get(name); },
    setHeader(name, value) { headers.set(name, value); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function makeAccessAdmin({ athlete, coachProfile = null, relationship = null }) {
  return {
    from(table) {
      const filters = {};
      let fields = '';
      return {
        select(value) { fields = value; return this; },
        eq(column, value) { filters[column] = value; return this; },
        async maybeSingle() {
          if (table === 'athletes') {
            if (filters.id !== athlete.id) return { data: null, error: null };
            if (fields === 'is_admin, session_version') {
              return {
                data: { is_admin: athlete.is_admin, session_version: athlete.session_version },
                error: null,
              };
            }
            return { data: athlete, error: null };
          }
          if (table === 'coach_profiles') {
            return {
              data: coachProfile?.athlete_id === filters.athlete_id ? coachProfile : null,
              error: null,
            };
          }
          if (table === 'coach_athlete_relationships') {
            const matches = relationship
              && relationship.coach_id === filters.coach_id
              && relationship.athlete_id === filters.athlete_id
              && relationship.status === filters.status;
            return { data: matches ? relationship : null, error: null };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };
    },
  };
}

test('primary experience, coach capability, paid entitlement, and admin authorization stay separate', () => {
  const paidAdminAthlete = buildAccountAccess({
    athlete: {
      id: 'athlete-1',
      primary_role: 'athlete',
      subscription_tier: 'coach',
      is_admin: true,
    },
  });
  assert.equal(paidAdminAthlete.primaryRole, 'athlete');
  assert.equal(paidAdminAthlete.capabilities.coach, false);
  assert.equal(paidAdminAthlete.capabilities.paidCoach, false);
  assert.equal(paidAdminAthlete.capabilities.administrator, true);
  assert.equal(paidAdminAthlete.defaultPath, '/dashboard');

  const freeCoach = buildAccountAccess({
    athlete: {
      id: 'athlete-2',
      primary_role: 'coach',
      subscription_tier: 'free',
      is_admin: false,
    },
    coachProfile: { id: 'coach-2' },
  });
  assert.equal(freeCoach.capabilities.coach, true);
  assert.equal(freeCoach.capabilities.paidCoach, false);
  assert.equal(freeCoach.capabilities.administrator, false);
  assert.equal(freeCoach.defaultPath, '/coach-command-center');
  assert.equal(hasRole(freeCoach, 'coach'), true);
});

test('server coach guards deny athletes and enforce the active athlete relationship', async () => {
  process.env.SESSION_COOKIE_SECRET = 'role-access-test-secret';
  const athlete = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Athlete Avery',
    primary_role: 'athlete',
    subscription_tier: 'coach',
    is_admin: false,
    onboarding_complete: true,
    session_version: 1,
  };
  const req = {
    method: 'GET',
    headers: { cookie: `${AUTH_COOKIE_NAME}=${signAthleteSession(athlete.id, 1)}` },
  };

  const denied = makeRes();
  const deniedAccess = await requireCoachAccess(req, denied, makeAccessAdmin({ athlete }));
  assert.equal(deniedAccess, null);
  assert.equal(denied.statusCode, 403);

  const coachProfile = { id: 'coach-1', athlete_id: athlete.id, display_name: 'Coach Avery' };
  const coachAdmin = makeAccessAdmin({ athlete, coachProfile });
  const allowed = makeRes();
  const coachAccess = await requireCoachAccess(req, allowed, coachAdmin);
  assert.equal(coachAccess.profile.id, 'coach-1');

  const unrelated = makeRes();
  assert.equal(
    await requireActiveCoachRelationship(unrelated, coachAdmin, 'coach-1', 'athlete-2'),
    null
  );
  assert.equal(unrelated.statusCode, 403);

  const relationship = {
    id: 'relationship-1',
    coach_id: 'coach-1',
    athlete_id: 'athlete-2',
    status: 'active',
  };
  const relatedAdmin = makeAccessAdmin({ athlete, coachProfile, relationship });
  const related = makeRes();
  assert.equal(
    (await requireActiveCoachRelationship(related, relatedAdmin, 'coach-1', 'athlete-2')).id,
    'relationship-1'
  );
});

test('documented signup roles map only to athlete or coach primary experience', () => {
  assert.equal(primaryRoleForSignupRole('coach'), 'coach');
  assert.equal(primaryRoleForSignupRole('athlete-with-coach'), 'athlete');
  assert.equal(primaryRoleForSignupRole('individual'), 'athlete');
  assert.equal(normalizeSignupRoleIntent('administrator'), null);
});

test('coach invitations deterministically force athlete signup intent', () => {
  const invitation = '/join?coach_invite=token-123';
  assert.equal(normalizeSignupRoleIntent('coach', invitation), 'athlete-with-coach');
  assert.equal(normalizeSignupRoleIntent('administrator', invitation), 'athlete-with-coach');
});

test('role intent endpoint rejects forged values and stores only validated httpOnly intent', () => {
  const rejected = makeRes();
  roleIntentHandler({ method: 'POST', body: { role: 'administrator' }, headers: {} }, rejected);
  assert.equal(rejected.statusCode, 400);

  const accepted = makeRes();
  roleIntentHandler({ method: 'POST', body: { role: 'coach' }, headers: {} }, accepted);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.primaryRole, 'coach');
  assert.match(String(accepted.getHeader('Set-Cookie')), /signup_role_intent=coach/);
  assert.match(String(accepted.getHeader('Set-Cookie')), /HttpOnly/);

  const invitation = makeRes();
  roleIntentHandler({
    method: 'POST',
    body: { role: 'coach', next: '/join?coach_invite=token-123' },
    headers: {},
  }, invitation);
  assert.equal(invitation.body.primaryRole, 'athlete');
});

test('email, Google, Strava, verification, and callback paths carry server role intent', () => {
  const signupPage = read('pages/signup.js');
  const signupApi = read('pages/api/auth/signup.js');
  const sessionApi = read('pages/api/auth/session.js');
  const stravaLogin = read('pages/api/strava/login.js');
  const stravaCallback = read('pages/api/strava/callback.js');

  assert.match(signupPage, /JSON\.stringify\(\{ name, email, password, role, next: nextPath \}\)/);
  assert.match(signupPage, /fetch\('\/api\/auth\/role-intent'/);
  assert.match(signupPage, /strava\/login\?next=.*&role=/s);
  assert.match(signupApi, /normalizeSignupRoleIntent\(role, next\)/);
  assert.match(signupApi, /callbackUrl\.searchParams\.set\('next', nextPath\)/);
  assert.match(sessionApi, /getPersistedPrimaryRoleIntent\(req\)/);
  assert.match(stravaLogin, /setSignupRoleIntent\(res, signupRole\)/);
  assert.match(stravaCallback, /getPersistedPrimaryRoleIntent\(req\)/);
});

test('role migration is idempotent, conservative, and leaves admin/subscription fields alone', () => {
  const migrationName = fs.readdirSync(path.join(root, 'supabase', 'migrations'))
    .find((name) => name.endsWith('_persist_primary_role.sql'));
  assert.ok(migrationName);
  const sql = read(`supabase/migrations/${migrationName}`);

  assert.match(sql, /ADD COLUMN IF NOT EXISTS primary_role/);
  assert.match(sql, /CHECK \(primary_role IN \('athlete', 'coach'\)\)/);
  assert.match(sql, /EXISTS \([\s\S]*FROM public\.coach_profiles/);
  assert.doesNotMatch(sql, /SET\s+(subscription_tier|is_admin)/i);
  assert.match(sql, /WHERE athlete\.primary_role = 'athlete'/);
});

test('coach APIs cannot implicitly create coach profiles', () => {
  const apiRoot = path.join(root, 'pages', 'api');
  const offenders = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) { walk(target); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const relative = path.relative(apiRoot, target).replaceAll('\\', '/');
      const source = fs.readFileSync(target, 'utf8');
      if (/ensureCoachProfile/.test(source)) offenders.push(relative);
      if (/\.from\('coach_profiles'\)[\s\S]{0,500}?\.insert\(/.test(source)
        && !['coach-profile.js', 'admin/demo.js'].includes(relative)) {
        offenders.push(relative);
      }
    }
  };
  walk(apiRoot);
  assert.deepEqual(offenders, []);

  const explicitCreation = read('pages/api/coach-profile.js');
  assert.match(explicitCreation, /primaryRole !== 'coach'/);
  assert.match(explicitCreation, /onboarding_complete/);
  assert.match(explicitCreation, /only be created during coach onboarding/);

  const onboarding = read('pages/api/onboarding.js');
  assert.match(onboarding, /Role selection is only available during onboarding/);
});

test('protected coach handlers use the canonical access helper', () => {
  const protectedFiles = [
    'pages/api/coach-roster.js',
    'pages/api/coach-assignments.js',
    'pages/api/coach/dashboard.js',
    'pages/api/coach/groups.js',
    'pages/api/coach/templates.js',
    'pages/api/coach/shared-docs.js',
    'pages/api/coach/relationships.js',
    'pages/api/coach/protocols.js',
    'pages/api/coach/profile-update.js',
    'pages/api/coach/notes.js',
    'pages/api/coach/invitations.js',
    'pages/api/coach/import-followup.js',
    'pages/api/coach/connection-requests.js',
    'pages/api/coach/athlete-detail.js',
    'pages/api/workout-library.js',
  ];
  for (const file of protectedFiles) {
    assert.match(read(file), /roleAccessServer/, `${file} bypasses the canonical helper`);
  }
});

test('athlete data coach actions require an active relationship', () => {
  for (const file of [
    'pages/api/coach/athlete-detail.js',
    'pages/api/coach/shared-docs.js',
    'pages/api/coach/protocols.js',
    'pages/api/coach/notes.js',
    'pages/api/coach-assignments.js',
  ]) {
    assert.match(read(file), /requireActiveCoachRelationship/, `${file} lacks active-roster enforcement`);
  }
});

test('/api/me returns persisted role and server-derived capabilities', () => {
  const source = read('pages/api/me.js');
  assert.match(source, /primary_role/);
  assert.match(source, /capabilities: access\.capabilities/);
  assert.match(source, /default_path: access\.defaultPath/);
});

test('desktop and mobile navigation are role-aware without hiding athlete training from coaches', () => {
  const athleteAccount = { primary_role: 'athlete', capabilities: { coach: false } };
  const coachAccount = { primary_role: 'coach', capabilities: { coach: true } };
  const athleteCoachAccount = { primary_role: 'athlete', capabilities: { coach: true } };

  const athleteSections = getSidebarSections(athleteAccount);
  assert.equal(athleteSections.some((section) => section.title === 'Coaching'), false);

  const coachSections = getSidebarSections(coachAccount);
  assert.equal(coachSections[0].title, 'Coaching');
  assert.equal(coachSections.some((section) => section.title === 'My Training'), true);

  const athleteCoachSections = getSidebarSections(athleteCoachAccount);
  assert.equal(athleteCoachSections[0].title, 'Training');
  assert.equal(athleteCoachSections.some((section) => section.title === 'Coaching'), true);

  assert.deepEqual(getMobileTabs(athleteAccount).map((tab) => tab.label), ['Home', 'Log', 'History', 'Research', 'Profile']);
  assert.deepEqual(getMobileTabs(coachAccount).map((tab) => tab.label), ['Roster', 'Calendar', 'Messages', 'Train', 'Profile']);
});
