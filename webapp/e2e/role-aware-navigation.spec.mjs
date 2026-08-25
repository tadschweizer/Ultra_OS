import { test, expect } from '@playwright/test';

function mePayload({ primaryRole, coach }) {
  return {
    athlete: {
      id: 'athlete-1',
      name: coach ? 'Coach Casey' : 'Athlete Avery',
      onboarding_complete: true,
      primary_role: primaryRole,
      subscription_tier: 'free',
      is_admin: false,
    },
    account: {
      primary_role: primaryRole,
      capabilities: {
        athlete: true,
        coach,
        paidCoach: false,
        administrator: false,
      },
      default_path: coach && primaryRole === 'coach' ? '/coach-command-center' : '/dashboard',
      coach_profile: coach ? { id: 'coach-1', display_name: 'Coach Casey' } : null,
    },
  };
}

async function mockAuthenticatedAccount(page, account, { delayMs = 0 } = {}) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me') {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(account),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connections: [],
        races: [],
        notifications: [],
        conversations: [],
        messages: [],
        unreadCount: 0,
      }),
    });
  });
}

test('desktop navigation defaults athletes to training and coaches to coaching', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');

  await mockAuthenticatedAccount(page, mePayload({ primaryRole: 'athlete', coach: false }));
  await page.goto('/account');
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByText('Training', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('Coaching', { exact: true })).toHaveCount(0);

  await page.evaluate(() => sessionStorage.clear());
  await page.unrouteAll({ behavior: 'wait' });
  await mockAuthenticatedAccount(page, mePayload({ primaryRole: 'coach', coach: true }));
  await page.reload();

  await expect(sidebar.getByText('Coaching', { exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Coach Command Center' })).toBeVisible();
  await expect(sidebar.getByText('My Training', { exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
});

test('390 px navigation uses the same role capabilities and survives refresh', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');

  await mockAuthenticatedAccount(page, mePayload({ primaryRole: 'coach', coach: true }));
  await page.goto('/account');
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav).toBeVisible();
  for (const label of ['Roster', 'Calendar', 'Messages', 'Train', 'Profile']) {
    await expect(nav.getByText(label, { exact: true })).toBeVisible();
  }

  await page.reload();
  await expect(nav.getByText('Roster', { exact: true })).toBeVisible();
  await expect(nav.getByText('Home', { exact: true })).toHaveCount(0);
});

test('a fresh browser context receives the persisted coach experience from the server', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');

  const secondDevice = await browser.newContext();
  const page = await secondDevice.newPage();
  await mockAuthenticatedAccount(page, mePayload({ primaryRole: 'coach', coach: true }));
  await page.goto('/account');

  const sidebar = page.locator('aside');
  await expect(sidebar.getByText('Coaching', { exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Coach Command Center' })).toBeVisible();
  await secondDevice.close();
});

test('role hydration exposes no coach navigation and direct coach URLs fail closed', async ({ page }) => {
  await mockAuthenticatedAccount(
    page,
    mePayload({ primaryRole: 'athlete', coach: false }),
    { delayMs: 250 }
  );

  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  const navigationResponse = page.waitForResponse((response) => response.url().endsWith('/api/me'));
  await page.goto('/coach/tools');
  await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
  await expect(navigation).toHaveCount(0);
  await navigationResponse;
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Coach Command Center', { exact: true })).toHaveCount(0);
});
