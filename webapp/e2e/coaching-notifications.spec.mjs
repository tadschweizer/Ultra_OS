import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function setup(page, available = true) {
  const state = { preferences: {}, available: { email: available, sms: available }, phone: null, phone_verified: false, sms_stopped: false, fail: false, saves: [] };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    let body = {}, status = 200;
    if (path === '/api/me') body = { athlete: { id: 'synthetic', name: 'Beth', primary_role: 'athlete', onboarding_complete: true }, account: { default_path: '/calendar', capabilities: { athlete: true } } };
    if (path === '/api/notifications') body = { preferences: {}, coachNotifications: [] };
    if (path === '/api/coaching-notification-settings') {
      if (method === 'PATCH') {
        const patch = route.request().postDataJSON().preferences;
        if (state.fail) { status = 503; body = { error: 'Could not save. Please retry.' }; }
        else { Object.assign(state.preferences, patch); state.saves.push(patch); }
      }
      if (status === 200) body = state;
    }
    if (path === '/api/coaching-notifications/phone') {
      const { action } = route.request().postDataJSON();
      if (action === 'start') { state.phone = '•••• 1234'; state.phone_verified = false; }
      if (action === 'check') state.phone_verified = true;
      if (action === 'remove') { state.phone = null; state.phone_verified = false; }
      body = { success: true };
    }
    await route.fulfill({ status, json: body });
  });
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Email and text alerts' })).toBeVisible();
  return state;
}

test('preferences persist, failed saves do not change switches, phone verification enables texts', async ({ page }, testInfo) => {
  const state = await setup(page);
  const email = page.getByRole('checkbox', { name: 'My coach assigns a new workout: Email', exact: true });
  const sms = page.getByRole('checkbox', { name: 'A coach or athlete comments on a workout: Text', exact: true });
  await expect(sms).toBeDisabled();
  await email.click(); await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.reload(); await expect(email).toBeChecked();
  state.fail = true; await email.click(); await expect(page.getByText('Could not save. Please retry.')).toBeVisible(); await expect(email).toBeChecked();
  state.fail = false;
  await page.getByLabel('Phone number, including country code').fill('+18015551234');
  await page.getByRole('checkbox', { name: /I agree to receive/ }).check();
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify phone', exact: true }).click();
  await expect(sms).toBeEnabled(); await sms.click(); await expect(sms).toBeChecked();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove phone' }).click();
  await expect(page.getByText('Phone removed. Text alerts are stopped.')).toBeVisible();
  // An enabled switch can always be switched off, even after removing the phone.
  await sms.click(); await expect(sms).not.toBeChecked(); await expect(sms).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).include('[aria-labelledby="training-alerts-title"]').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('notification-settings.png'), fullPage: true });
});

test('unconfigured delivery shows availability honestly and leaves switches off', async ({ page }) => {
  await setup(page, false);
  await expect(page.getByText('Text alerts are not available yet.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'An athlete uploads or completes a workout: Text', exact: true })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'My coach assigns a new workout: Email', exact: true })).toBeDisabled();
});
