import { test, expect } from '@playwright/test';

const invitation = {
  status: 'pending',
  coach: { id: 'coach-1', display_name: 'Coach Casey' },
  expires_at: '2026-08-22T12:00:00.000Z',
};

async function mockInvitation(page, { authenticated = false, preview = invitation } = {}) {
  let postCount = 0;
  let isAuthenticated = authenticated;
  await page.route('**/api/me', (route) => route.fulfill({
    status: isAuthenticated ? 200 : 401,
    contentType: 'application/json',
    body: JSON.stringify(isAuthenticated ? { athlete: { id: 'athlete-1', onboarding_complete: true } } : { error: 'Not authenticated' }),
  }));
  await page.route('**/api/coach/accept-invitation**', async (route) => {
    if (route.request().method() === 'POST') {
      postCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, coach: invitation.coach }),
      });
      return;
    }
    await route.fulfill({
      status: preview.httpStatus || 200,
      contentType: 'application/json',
      body: JSON.stringify(preview.body || preview),
    });
  });
  return {
    authenticate() { isAuthenticated = true; },
    getPostCount() { return postCount; },
  };
}

async function mockEmailAuth(page, invitationState, endpoint) {
  await page.route('**/api/auth/logout', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.route(`**/api/auth/${endpoint}`, (route) => {
    invitationState.authenticate();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, onboardingComplete: false }),
    });
  });
}

async function acceptOnceAndVerify(page, invitationState) {
  await expect(page).toHaveURL(/\/join\?coach_invite=token-1$/);
  const acceptButton = page.getByRole('button', { name: 'Accept invitation' });
  await expect(acceptButton).toBeVisible();

  // Exercise duplicate user events while the request is in flight. The UI
  // must still issue exactly one acceptance mutation.
  await acceptButton.evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(page.getByRole('heading', { name: 'Invitation accepted' })).toBeVisible();
  await expect(page.getByText(/relationship now appears in your account and your coach's roster/i)).toBeVisible();
  expect(invitationState.getPostCount()).toBe(1);
}

test('logged-out athlete completes email login, returns to the invitation, and accepts once', async ({ page }) => {
  const invitationState = await mockInvitation(page);
  await mockEmailAuth(page, invitationState, 'login');
  await page.goto('/join?coach_invite=token-1');
  await expect(page.getByRole('heading', { name: 'Join Coach Casey on Threshold' })).toBeVisible();

  await page.getByRole('link', { name: 'Log in to accept' }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.locator('input[autocomplete="email"]').fill('athlete@example.com');
  await page.locator('#login-password').fill('CorrectHorseBattery9!');
  await page.getByRole('button', { name: 'Log In →' }).click();

  await acceptOnceAndVerify(page, invitationState);
});

test('logged-out athlete completes signup, returns to the invitation, and accepts once', async ({ page }) => {
  const invitationState = await mockInvitation(page);
  await mockEmailAuth(page, invitationState, 'signup');
  await page.goto('/join?coach_invite=token-1');
  await expect(page.getByRole('heading', { name: 'Join Coach Casey on Threshold' })).toBeVisible();

  await page.getByRole('link', { name: 'Create athlete account' }).click();
  await expect(page).toHaveURL(/\/signup\?/);
  await page.locator('input[autocomplete="name"]').fill('Athlete Avery');
  await page.locator('input[autocomplete="email"]').fill('athlete@example.com');
  await page.locator('#signup-password').fill('CorrectHorseBattery9!');
  await page.getByRole('button', { name: 'Create Account →' }).click();

  await acceptOnceAndVerify(page, invitationState);
});

test('signed-in athlete accepts once and sees the completed relationship state', async ({ page }) => {
  const invitationState = await mockInvitation(page, { authenticated: true });
  await page.goto('/join?coach_invite=token-1');
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('heading', { name: 'Invitation accepted' })).toBeVisible();
  await expect(page.getByText(/relationship now appears in your account and your coach's roster/i)).toBeVisible();
  expect(invitationState.getPostCount()).toBe(1);
});

for (const scenario of [
  { code: 'invalid', status: 404, heading: 'Invalid invitation', error: 'That invitation link is not valid.' },
  { code: 'expired', status: 410, heading: 'Invitation expired', error: 'That invitation has expired.' },
  { code: 'used', status: 409, heading: 'Invitation already used', error: 'That invitation has already been used.' },
  { code: 'already_accepted', status: 409, heading: 'Already connected', error: 'You are already connected to Coach Casey.' },
]) {
  test(`${scenario.code} invitation has a clear state`, async ({ page }) => {
    await mockInvitation(page, {
      authenticated: true,
      preview: { httpStatus: scenario.status, body: { code: scenario.code, error: scenario.error, coach: invitation.coach } },
    });
    await page.goto('/join?coach_invite=token-1');
    await expect(page.getByRole('heading', { name: scenario.heading })).toBeVisible();
  });
}
