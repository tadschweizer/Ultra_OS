import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const preview = { plan: { id: 'pro_annual', label: 'Athlete Pro Annual' },
  price: { amount: 14400, currency: 'usd', interval: 'year', intervalCount: 1 },
  currentPrice: { amount: 1500, currency: 'usd', interval: 'month', intervalCount: 1 },
  changing: true, samePlan: false, intent: 'signed-review' };
async function mock(page, { failure = false, samePlan = false, previewFails = false, freeWithBilling = false } = {}) {
  const requests = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let status = 200; let body = {};
    if (path === '/api/me') body = { athlete: { id: 'athlete-1', primary_role: 'athlete', subscription_tier: freeWithBilling ? 'free' : 'pro', stripe_subscription_id: freeWithBilling ? 'sub_incomplete' : null, onboarding_complete: true },
      account: { primary_role: 'athlete', capabilities: { athlete: true, coach: false } } };
    if (path === '/api/billing/preview') { status = previewFails ? 503 : 200; body = previewFails ? { error: 'Billing is temporarily unavailable.' } : { ...preview, samePlan }; }
    if (['/api/billing/checkout', '/api/billing/portal'].includes(path)) {
      requests.push({ path, method: route.request().method(), body: route.request().postDataJSON() });
      await new Promise(resolve => setTimeout(resolve, 1000));
      status = failure ? 409 : 200;
      body = failure ? { error: 'Review expired. Review the plan again.' } : { url: '/account?billing=test-return' };
    }
    if (path === '/api/coach-connection') body = { connections: [] };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return requests;
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test('review shows current and recurring price, then exactly one protected POST after explicit action', async ({ page }, info) => {
  const requests = await mock(page);
  await page.goto('/billing/checkout?plan=pro_annual');
  await expect(page.getByRole('heading', { name: 'Review your plan' })).toBeVisible();
  await expect(page.getByText('$144.00 / year', { exact: true })).toBeVisible();
  await expect(page.getByText('$15.00 / month', { exact: true })).toBeVisible();
  await expect(page.getByText(/Stripe will show the exact amount due/)).toBeVisible();
  expect(requests).toHaveLength(0); await noOverflow(page);
  await page.screenshot({ path: fileURLToPath(new URL(`../../output/p010-${info.project.name}.png`, import.meta.url)), fullPage: true });
  const button = page.getByRole('button', { name: 'Continue to Stripe for confirmation' });
  await button.click(); await expect(page.getByRole('button', { name: 'Opening secure billing…' })).toBeDisabled();
  await expect(page).toHaveURL(/billing=test-return/);
  expect(requests).toEqual([{ path: '/api/billing/checkout', method: 'POST', body: { plan: 'pro_annual', intent: 'signed-review' } }]);
});
test('expired review shows actionable error and requires a fresh review', async ({ page }) => {
  const requests = await mock(page, { failure: true });
  await page.goto('/billing/checkout?plan=pro_annual');
  await page.getByRole('button', { name: 'Continue to Stripe for confirmation' }).click();
  await expect(page.locator('main [role="alert"]')).toContainText('Review expired');
  await expect(page.getByRole('button', { name: 'Continue to Stripe for confirmation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review billing again' }).click();
  await expect(page.getByRole('button', { name: 'Continue to Stripe for confirmation' })).toBeVisible();
  expect(requests).toHaveLength(1); await noOverflow(page);
});
test('unavailable preview has retry without starting billing', async ({ page }) => {
  const requests = await mock(page, { previewFails: true });
  await page.goto('/billing/checkout?plan=pro_annual');
  await expect(page.locator('main [role="alert"]')).toContainText('temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Review billing again' })).toBeVisible();
  expect(requests).toHaveLength(0); await noOverflow(page);
});
test('same plan directs to management and never claims a plan change', async ({ page }) => {
  await mock(page, { samePlan: true }); await page.goto('/billing/checkout?plan=pro_annual');
  await expect(page.getByRole('heading', { name: 'You already have this plan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage billing in Stripe' })).toBeVisible();
});
test('account billing management uses a POST button and disables while opening', async ({ page }) => {
  const requests = await mock(page); await page.goto('/account');
  const button = page.getByRole('button', { name: 'Manage Billing', exact: true }); await button.click();
  await expect(page.getByRole('button', { name: 'Opening billing…' })).toBeDisabled(); await expect(page).toHaveURL(/billing=test-return/);
  expect(requests).toEqual([{ path: '/api/billing/portal', method: 'POST', body: {} }]);
});
test('free-tier account with a linked failed or cancelled subscription can still manage billing', async ({ page }) => {
  const requests = await mock(page, { freeWithBilling: true }); await page.goto('/account');
  await page.getByRole('button', { name: 'Manage Billing', exact: true }).click();
  await expect(page).toHaveURL(/billing=test-return/);
  expect(requests).toEqual([{ path: '/api/billing/portal', method: 'POST', body: {} }]);
});
