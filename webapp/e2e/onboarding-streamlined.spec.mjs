import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function setup(page, options = {}) {
  const state = { authenticated: !options.signup, complete: false, accepted: !options.signup, saves: [], requests: 0, failConnections: options.failConnections, pending: false };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    let status = 200, body = {};
    if (url.pathname === '/api/me') {
      status = state.authenticated ? 200 : 401;
      body = { athlete: { id: 'test-athlete', primary_role: options.coach ? 'coach' : 'athlete', onboarding_complete: state.complete, strava_id: options.connected ? 123 : null }, account: { default_path: '/calendar', capabilities: { athlete: true, coach: !!options.coach } } };
    }
    if (url.pathname === '/api/auth/signup') { state.authenticated = true; body = { onboardingComplete: false }; }
    if (url.pathname === '/api/coach/accept-invitation') {
      body = { coach: { display_name: 'Coach Casey' } };
      if (method === 'POST') state.accepted = true;
    }
    if (url.pathname === '/api/coach-profile') body = { profile: { coach_code: 'CASEY-123' } };
    if (url.pathname === '/api/onboarding') {
      body = { athlete: { primary_role: options.coach ? 'coach' : 'athlete', target_race_id: 'existing-race', primary_sports: [] }, signupRole: options.coach ? 'coach' : 'athlete-with-coach' };
      if (method === 'POST') { const saved = route.request().postDataJSON(); state.saves.push(saved); state.complete = saved.onboarding_complete; }
    }
    if (url.pathname === '/api/coach-connection') {
      const connection = { id: 'link', status: state.pending ? 'pending' : 'active', coach: { display_name: 'Coach Casey' } };
      body = { connections: options.noCoach && !state.pending || !state.accepted ? [] : [connection] };
      if (state.failConnections) { status = 503; body = { error: 'Unavailable' }; }
      if (method === 'POST') { state.requests++; state.pending = true; body = { connection: { ...connection, status: 'pending' } }; }
    }
    if (url.pathname === '/api/integrations/status') body = { strava: true };
    if (url.pathname === '/api/planned-workouts') body = { workouts: [], activities: [] };
    await route.fulfill({ status, json: body });
  });
  return state;
}

async function layout(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
}

test('invitation signup keeps the coach through acceptance and two-screen setup', async ({ page }, info) => {
  const state = await setup(page, { signup: true });
  await page.goto('/join?coach_invite=token');
  await page.getByRole('link', { name: 'Create athlete account' }).click();
  await expect(page.getByText('How will you use Threshold?')).toHaveCount(0);
  await page.locator('input[autocomplete="name"]').fill('Avery');
  await page.locator('input[autocomplete="email"]').fill('avery@example.test');
  await page.locator('#signup-password').fill('CorrectHorseBattery9!');
  await page.getByRole('button', { name: 'Create Account →' }).click();
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await page.getByRole('link', { name: 'Continue to Threshold' }).click();
  await expect(page.getByText('Coach Casey', { exact: true })).toBeVisible();
  await expect(page.getByText('Connected — your coach can plan and review your training.')).toBeVisible();
  await expect(page.getByLabel('Coach code', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Connect Strava' })).toHaveAttribute('href', '/api/strava/login?next=%2Fcalendar');
  await layout(page);
  await page.screenshot({ path: `output/playwright/onboarding-connections-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Trail Runner', exact: true }).click();
  await page.getByLabel('Usual training hours').selectOption('8-12');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Trail Runner', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await layout(page);
  await page.screenshot({ path: `output/playwright/onboarding-profile-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Open my training' }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  expect(state.saves).toHaveLength(1);
  expect(state.saves[0]).toMatchObject({ target_race_id: 'existing-race', primary_sports: ['Trail Runner'], weekly_training_hours_band: '8-12', onboarding_complete: true });
});

test('failed coach lookup can retry without falsely asking for a new connection', async ({ page }) => {
  const state = await setup(page, { failConnections: true });
  await page.goto('/onboarding');
  await expect(page.locator('main').getByRole('alert')).toContainText('could not check your coach');
  await expect(page.getByLabel('Coach code', { exact: true })).toHaveCount(0);
  state.failConnections = false;
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByText('Coach Casey', { exact: true })).toBeVisible();
});

test('manual code request stays pending and optional profile can be skipped', async ({ page }) => {
  const state = await setup(page, { noCoach: true });
  await page.goto('/onboarding');
  await page.getByLabel('Coach code', { exact: true }).fill('CASEY-123');
  await page.getByRole('button', { name: 'Send connection request' }).click();
  await expect(page.getByText('Request sent — waiting for your coach to approve.')).toBeVisible();
  expect(state.requests).toBe(1);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Open my training' }).click();
  await expect(page).toHaveURL(/\/calendar$/);
});

test('Strava return remains in setup and shows server-confirmed connection', async ({ page }) => {
  const state = await setup(page, { connected: true });
  await page.goto('/onboarding?strava=connected');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Connect Strava' })).toHaveCount(0);
  expect(state.saves).toHaveLength(0);
});

test('coach onboarding opens roster after successful save', async ({ page }) => {
  const state = await setup(page, { coach: true });
  await page.goto('/onboarding');
  await expect(page.getByText('CASEY-123')).toBeVisible();
  await page.getByRole('button', { name: 'Open your roster' }).click();
  await expect(page).toHaveURL(/\/coach-command-center$/);
  expect(state.saves[0].role).toBe('coach');
});
