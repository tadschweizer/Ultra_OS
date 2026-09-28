import { test, expect } from '@playwright/test';

const me = {
  athlete: { id: 'athlete-1', name: 'Athlete Avery', onboarding_complete: true, primary_role: 'athlete', subscription_tier: 'free', is_admin: false },
  account: { primary_role: 'athlete', capabilities: { athlete: true, coach: false, paidCoach: false, administrator: false }, default_path: '/dashboard', coach_profile: null },
  lastCheckInDate: null,
};

async function mockApi(page, { failFirstSave = false } = {}) {
  const saves = [];
  let failed = false;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) });
    }
    if (url.pathname === '/api/log-intervention') {
      saves.push(route.request().postDataJSON());
      if (failFirstSave && !failed) {
        failed = true;
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporarily unavailable' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return saves;
}

test('check-in needs three taps, prefills today, and posts legs/energy/RPE', async ({ page }) => {
  const saves = await mockApi(page);
  await page.goto('/check-in');
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await expect(page.getByLabel('Date')).toHaveValue(today);
  const save = page.getByRole('button', { name: /Pick all three to save/ });
  await expect(save).toBeDisabled();

  await page.getByRole('button', { name: 'Legs 7 of 10' }).click();
  await page.getByRole('button', { name: 'Energy 6 of 10' }).click();
  await page.getByRole('button', { name: 'Effort (RPE) 4 of 10' }).click();
  await page.getByRole('button', { name: 'Save check-in' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Check-in saved' })).toBeVisible();
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({
    intervention_type: 'Workout Check-in',
    checkin_fast: true,
    date: today,
    protocol_payload: { legs_feel: 7, energy_feel: 6, perceived_effort: 4 },
  });
});

test('a failed save keeps answers and can be retried', async ({ page }) => {
  const saves = await mockApi(page, { failFirstSave: true });
  await page.goto('/check-in');
  await page.getByRole('button', { name: 'Legs 3 of 10' }).click();
  await page.getByRole('button', { name: 'Energy 3 of 10' }).click();
  await page.getByRole('button', { name: 'Effort (RPE) 8 of 10' }).click();
  await page.getByRole('button', { name: 'Save check-in' }).click();

  await expect(page.getByText('Temporarily unavailable')).toBeVisible();
  await expect(page.getByText('Temporarily unavailable')).toContainText('Temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Legs 3 of 10' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Check-in saved' })).toBeVisible();
  expect(saves).toHaveLength(2);
});

test('athlete mobile nav links to check-in and the page fits 390 px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await mockApi(page);
  await page.goto('/account');
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav.getByText('Check-in', { exact: true })).toBeVisible();
  await nav.getByText('Check-in', { exact: true }).click();
  await expect(page).toHaveURL(/\/check-in$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
