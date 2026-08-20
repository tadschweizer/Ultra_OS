import { test, expect } from '@playwright/test';

const invitation = {
  status: 'pending',
  coach: { id: 'coach-1', display_name: 'Coach Casey' },
  expires_at: '2026-08-22T12:00:00.000Z',
};

async function mockInvitation(page, { authenticated = false, preview = invitation } = {}) {
  let postCount = 0;
  await page.route('**/api/me', (route) => route.fulfill({
    status: authenticated ? 200 : 401,
    contentType: 'application/json',
    body: JSON.stringify(authenticated ? { athlete: { id: 'athlete-1', onboarding_complete: true } } : { error: 'Not authenticated' }),
  }));
  await page.route('**/api/coach/accept-invitation**', async (route) => {
    if (route.request().method() === 'POST') {
      postCount += 1;
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
  return () => postCount;
}

test('logged-out athlete keeps the canonical invitation through signup and login', async ({ page }) => {
  await mockInvitation(page);
  await page.goto('/join?coach_invite=token-1');
  await expect(page.getByRole('heading', { name: 'Join Coach Casey on Threshold' })).toBeVisible();

  const signupHref = await page.getByRole('link', { name: 'Create athlete account' }).getAttribute('href');
  const loginHref = await page.getByRole('link', { name: 'Log in to accept' }).getAttribute('href');
  expect(signupHref).toContain('role=athlete-with-coach');
  expect(decodeURIComponent(signupHref)).toContain('next=/join?coach_invite=token-1');
  expect(decodeURIComponent(loginHref)).toContain('next=/join?coach_invite=token-1');
});

test('signed-in athlete accepts once and sees the completed relationship state', async ({ page }) => {
  const getPostCount = await mockInvitation(page, { authenticated: true });
  await page.goto('/join?coach_invite=token-1');
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('heading', { name: 'Invitation accepted' })).toBeVisible();
  await expect(page.getByText(/relationship now appears in your account and your coach's roster/i)).toBeVisible();
  expect(getPostCount()).toBe(1);
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
