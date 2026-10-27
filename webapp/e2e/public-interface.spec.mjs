import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const openAccessCopy = 'All currently available athlete features are free during early access. No subscription or payment card is needed.';
async function anonymous(page, { delay = 0, signupFailure = false } = {}) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me') {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return route.fulfill({ status: 401, json: {} });
    }
    if (path === '/api/auth/signup' || path === '/api/auth/login') {
      return signupFailure ? route.abort('connectionfailed') : route.fulfill({ status: 400, json: { error: 'Please check your account details and try again.' } });
    }
    return route.fulfill({ status: path === '/api/site-review' ? 403 : 200, json: {} });
  });
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const axe = async page => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
};

test('public pages retain navigation, real example, coherent access and heading structure', async ({ page }, info) => {
  await anonymous(page);
  const paidMode = process.env.PUBLIC_INTERFACE_PAID_MODE === '1';
  for (const path of ['/', '/pricing', '/guide', '/support']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: 'Threshold home', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await overflow(page)).toBe(false);
    if (path === '/' || path === '/guide') {
      const img = page.getByRole('img', { name: /Threshold session view/ });
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    if (!paidMode && (path === '/' || path === '/pricing')) await expect(page.getByText(openAccessCopy, { exact: false })).toBeVisible();
    if (path === '/guide') {
      await expect(page.getByRole('heading', { name: /Plan a week your athlete can follow/ })).toBeVisible();
      await page.getByText('Intervention records', { exact: true }).first().click();
      await expect(page.getByRole('link', { name: 'Open intervention log' })).toBeVisible();
    }
    if (!paidMode) await axe(page);
    await page.screenshot({ path: `output/public-interface/${path === '/' ? 'home' : path.slice(1)}-${info.project.name}.png`, fullPage: true });
    if (path === '/') await page.locator('main > div > section').first().screenshot({ path: `output/public-interface/home-hero-${info.project.name}.png` });
  }
});

test('authenticated menus preserve athlete and coach actions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const role of ['athlete', 'coach']) {
    await page.unrouteAll();
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({ status: path === '/api/site-review' ? 403 : 200, json: path === '/api/me'
        ? { athlete: { id: 'example-account', onboarding_complete: true, primary_role: role },
            account: { primary_role: role, capabilities: { athlete: true, coach: role === 'coach' } } }
        : {} });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('link', { name: role === 'coach' ? 'Open Coach Roster' : 'Log intervention', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});

test('public layouts remain usable at narrow and tablet widths', async ({ page }) => {
  await anonymous(page);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/guide', '/signup']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await overflow(page)).toBe(false);
    }
  }
});

test('signup has labelled fields, native role selection, correct access and recoverable network error', async ({ page }, info) => {
  await anonymous(page, { signupFailure: true, delay: 150 });
  await page.goto('/signup?role=coach&next=%2Fcalendar');
  await expect(page.getByRole('radio', { name: "I'm a coach", exact: true })).toBeChecked();
  await page.getByRole('radio', { name: "I'm an individual athlete", exact: true }).check();
  const copy = process.env.PUBLIC_INTERFACE_PAID_MODE === '1' ? 'Free accounts include 15 intervention logs' : openAccessCopy;
  await expect(page.getByText(copy, { exact: false })).toBeVisible();
  if (process.env.PUBLIC_INTERFACE_PAID_MODE !== '1') await expect(page.getByText(/15 intervention logs|3 check-ins per/)).toHaveCount(0);
  await page.getByLabel('Name', { exact: true }).fill('Example Athlete');
  await page.getByLabel('Email', { exact: true }).fill('fictional@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Mock workout phrase 2026!');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Check your connection');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Example Athlete');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('fictional@example.test');
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeEnabled();
  await axe(page);
  expect(await overflow(page)).toBe(false);
  await page.screenshot({ path: `output/public-interface/signup-${info.project.name}.png`, fullPage: true });
});

test('login labels and error recovery preserve destination and entered values', async ({ page }) => {
  await anonymous(page, { signupFailure: true });
  await page.goto('/login?next=%2Fcalendar');
  await page.getByLabel('Email', { exact: true }).fill('fictional@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Mock workout phrase 2026!');
  await page.getByRole('button', { name: 'Log In', exact: false }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Check your connection');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('fictional@example.test');
  await expect(page.getByRole('link', { name: 'Sign up free', exact: true })).toHaveAttribute('href', '/signup?next=%2Fcalendar');
  await axe(page);
});

test('mobile menu contains focus, has relevant public actions, closes safely and restores focus', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await anonymous(page);
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open menu', exact: true });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Public navigation' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Close menu' })).toBeFocused();
  await expect(menu.getByRole('link', { name: /Log intervention/i })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Create a coach pilot account' })).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await menu.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await menu.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await axe(page);
  await page.screenshot({ path: `output/public-interface/menu-${info.project.name}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});
