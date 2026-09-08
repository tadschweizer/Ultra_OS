import { test, expect } from '@playwright/test';
import { pilotDb, athleteId, coachOwnerId, coachId, adminId, fixedNow } from '../tests/helpers/pilotDb.mjs';
import { loadCheckInEntitlement, loadCoachEntitlement } from '../lib/pilotEntitlementsServer.js';
import { buildUsageSnapshot } from '../lib/subscriptionTiers.js';
import { buildAccountAccess } from '../lib/auth/roleGuards.js';
import { createLogInterventionHandler } from '../pages/api/log-intervention.js';
import { createPilotAccessHandler } from '../pages/api/admin/pilot-access.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';

process.env.SESSION_COOKIE_SECRET = 'browser-pilot-isolated-test-secret-more-than-32-characters';
process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000';

// Browser rendering and real handler logic, with isolated in-memory accounts/database.
// This deliberately does not claim Supabase/staging persistence.
async function routeAccount(page, db, id) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let status = 200, payload;
    const athlete = db.tables.athletes.find(row => row.id === id);
    const profile = db.tables.coach_profiles.find(row => row.athlete_id === id) || null;
    if (url.pathname === '/api/me') {
      const access = buildAccountAccess({ athlete, coachProfile: profile });
      const entitlement = await loadCheckInEntitlement(db, athlete, db.now);
      const coachAccess = await loadCoachEntitlement(db, profile, athlete, db.now);
      payload = { athlete: { ...athlete, name: 'Pilot test account', onboarding_complete: true },
        account: { primary_role: access.primaryRole, capabilities: access.capabilities, coach_profile: profile,
          default_path: access.defaultPath, coach_access: coachAccess },
        usage: buildUsageSnapshot({ athlete, weeklyCheckIns: db.tables.interventions.length, checkInEntitlement: entitlement }) };
    } else if (['/api/log-intervention', '/api/admin/pilot-access'].includes(url.pathname)) {
      const req = { method: route.request().method(), headers: { cookie: `athlete_id=${signAthleteSession(id)}`,
        origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' },
        query: Object.fromEntries(url.searchParams), body: route.request().postDataJSON() || {} };
      const res = { status(code) { status = code; return this; }, json(body) { payload = body; return this; }, end() {}, setHeader() {} };
      const handler = url.pathname === '/api/log-intervention' ? createLogInterventionHandler : createPilotAccessHandler;
      await handler({ getClient: () => db, now: () => db.now })(req, res);
    } else {
      payload = { profile, summary: { total_athletes: 0 }, relationships: [], protocols: [], templates: [],
        invitations: [], connections: [], races: [], activities: [], interventions: [], notifications: [],
        conversations: [], messages: [], requests: [], unreadCount: 0 };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}
test('public coach signup and pricing explain separate pilot approval', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/signup?role=coach');
  await expect(page.getByText(/Choosing Coach does not activate a pilot or paid plan/)).toBeVisible();
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: /Closed coach pilot/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Create coach account/ })).toHaveAttribute('href', '/signup?role=coach');
  await expect(page.locator('a[href="/api/billing/checkout?plan=individual_annual"]')).toHaveCount(1);
  await expect(page.locator('a[href="/api/billing/checkout?plan=research_monthly"]')).toHaveCount(1);
  await expect(page.getByText('During your approved pilot period')).toBeVisible();
  await page.goto('/signup?plan=individual_annual');
  await expect(page.getByRole('link', { name: 'Log in' }).first()).toHaveAttribute(
    'href',
    /next=%2Fapi%2Fbilling%2Fcheckout%3Fplan%3Dindividual_annual/
  );
  await page.goto('/signup?plan=coach_monthly');
  await expect(page.getByRole('link', { name: 'Log in' }).first()).toHaveAttribute(
    'href',
    '/login?next=%2Fdashboard'
  );
});
test('coach role alone is locked; approved pilot opens workspace; revocation survives refresh', async ({ page }) => {
  const db = pilotDb({ pilot: false });
  await routeAccount(page, db, coachOwnerId);
  await page.goto('/coach-command-center');
  await expect(page.getByText('Closed coach pilot', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pilot Coach' })).toHaveCount(0);
  db.tables.coach_pilot_entitlements = pilotDb().tables.coach_pilot_entitlements;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pilot Coach' })).toBeVisible();
  db.tables.coach_pilot_entitlements[0].revoked_at = fixedNow.toISOString();
  await page.reload();
  await expect(page.getByText('Closed coach pilot', { exact: true })).toBeVisible();
});
test('athlete saves seven useful daily check-ins, then sees revoked access without losing history', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const db = pilotDb();
  await routeAccount(page, db, athleteId);
  for (let day = 0; day < 7; day++) {
    db.now = new Date(fixedNow.getTime() + day * 86400000);
    await page.goto('/log-intervention');
    await expect(page.getByText(/Daily workout check-ins are included/)).toBeVisible();
    await page.getByRole('button', { name: /Workout Check-in/ }).first().click();
    for (const [label, value] of [['Legs feel (1=dead, 10=fresh)', '7'], ['Energy level (1=wiped, 10=great)', '6'], ['Perceived effort / RPE (1-10)', '5']]) {
      await page.locator('label').filter({ hasText: label }).locator('..').locator('input').fill(value, { timeout: 10000 });
    }
    await page.locator('input[name="date"]').fill(db.now.toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Save Intervention', exact: true }).click();
    await expect(page.getByText('Intervention logged.', { exact: true })).toBeVisible();
  }
  expect(db.tables.interventions).toHaveLength(7);
  expect(new Set(db.tables.interventions.map(row => row.date)).size).toBe(7);
  expect(db.tables.interventions.every(row => Number(row.protocol_payload.legs_feel) === 7 && Number(row.protocol_payload.energy_feel) === 6 && Number(row.protocol_payload.perceived_effort) === 5)).toBeTruthy();
  db.tables.coach_pilot_entitlements[0].revoked_at = db.now.toISOString();
  await page.reload();
  await expect(page.getByText('0 of 3 free check-ins remaining this week')).toBeVisible();
  await page.getByRole('button', { name: /Workout Check-in/ }).first().click();
  await page.getByRole('button', { name: 'Save Intervention', exact: true }).click();
  await expect(page.getByText(/Error: Free accounts can log 3 check-ins/)).toBeVisible();
  expect(db.tables.interventions).toHaveLength(7);
  await page.screenshot({ path: `../output/pilot-checkins-${testInfo.project.name}.png`, fullPage: true });
});
test('administrator provisions and revokes pilot using the form', async ({ page }, testInfo) => {
  const db = pilotDb({ pilot: false });
  await routeAccount(page, db, adminId);
  await page.goto('/admin/pilot-access');
  await page.getByLabel('Coach profile ID').fill(coachId);
  await page.getByRole('button', { name: 'Inspect coach' }).click();
  await expect(page.getByText('No pilot grant.')).toBeVisible();
  await page.getByLabel('Pilot ends (your local time)').fill('2026-10-01T12:00');
  await page.getByLabel('Reason', { exact: true }).fill('Approved closed pilot');
  await page.getByRole('button', { name: 'Grant or renew pilot' }).click();
  await expect(page.getByText(/Pilot Coach · Saved/)).toBeVisible();
  expect(db.tables.coach_pilot_entitlements).toHaveLength(1);
  await page.getByRole('button', { name: 'Revoke pilot' }).click();
  await expect(page.getByText('Pilot revoked.')).toBeVisible();
  expect(db.tables.coach_pilot_entitlements[0].revoked_at).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../output/pilot-admin-${testInfo.project.name}.png`, fullPage: true });
});

test('entitlement failure removes cached pilot claim and displays a retry message', async ({ page }) => {
  const db = pilotDb();
  await routeAccount(page, db, coachOwnerId);
  await page.goto('/coach-command-center');
  await expect(page.getByRole('heading', { name: 'Pilot Coach' })).toBeVisible();
  await page.route('**/api/me', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Access could not be verified.' }) }));
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Access could not be verified.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pilot Coach' })).toHaveCount(0);
});

test('entitlement failure is explicit in a new session without cached account data', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Access could not be verified.' }),
  }));
  await page.goto('/coach-command-center');
  await expect(page.getByRole('alert').filter({ hasText: 'Access could not be verified.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pilot Coach' })).toHaveCount(0);
  await page.goto('/dashboard');
  await expect(page.getByRole('alert').filter({ hasText: 'Access could not be verified.' })).toBeVisible();
  await expect(page.getByText('Application error')).toHaveCount(0);
});
