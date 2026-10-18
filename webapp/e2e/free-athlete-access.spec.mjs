import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('coaching advantages and free access are clear without checkout links', async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ status: 401, json: { error: 'Not authenticated' } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Plan the week. Review the result. Keep coaching.' })).toBeVisible();
  await expect(page.getByText('Free athlete access.', { exact: true })).toBeVisible();
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Athlete access is free.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create a free athlete account' })).toHaveAttribute('href', '/signup');
  await expect(page.locator('a[href*="checkout"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.goto('/billing/checkout?plan=pro_monthly');
  await expect(page.getByRole('heading', { name: 'Athlete access is free.' })).toBeVisible();
  const response = await page.request.post('/api/billing/checkout', { data: { plan: 'pro_monthly' } });
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe('ATHLETE_OPEN_ACCESS');
});
