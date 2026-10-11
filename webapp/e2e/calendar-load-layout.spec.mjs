import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { calendarFixture, athlete } from '../tests/helpers/calendar-gap-fixture.mjs';

test('athlete load and status remain complete at 320px, 390px and desktop with actuals and long labels', async ({ page }, info) => {
  test.setTimeout(90000);
  const f = await calendarFixture();
  const state = { lastMe: null, label: null, external: [], errors: [] };
  const observations = [];
  page.on('pageerror', error => state.errors.push(error.message));
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      state.external.push(request.url()); return route.abort();
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/me') {
      const result = await f.invoke('me', { actor: athlete });
      // Deliberate display-only stress fixture; calculated values and real
      // signed handler response are retained. This is not a new load status.
      if (state.label && result.body.load_status) result.body.load_status.label = state.label;
      state.lastMe = result.body;
      return route.fulfill({ status: result.code, json: result.body });
    }
    if (url.pathname === '/api/planned-workouts') {
      const result = await f.invoke('calendar', { actor: athlete, method: request.method(), query: Object.fromEntries(url.searchParams) });
      return route.fulfill({ status: result.code, json: result.body });
    }
    return route.fulfill({ status: 501, json: { error: 'Outside this isolated layout fixture' } });
  });
  try {
    const widths = info.project.name === 'mobile-chromium' ? [320, 390] : [1440];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      for (const phase of ['empty-actuals', 'recorded-actuals', 'long-status']) {
        state.lastMe = null;
        state.label = phase === 'long-status' ? 'HighTrainingLoadStatusWithUnbrokenSyntheticFixtureLabel' : null;
        await f.pg.query(`update planned_workouts set visibility='athlete_visible',workout_date=current_date,
          status=$1,completed_duration_min=$2,completed_distance_km=$3,athlete_rpe=$4`,
        phase === 'empty-actuals' ? ['planned', null, null, null] : ['completed', 35, 5.1, 7]);
        await page.goto('/calendar');
        const header = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Training Calendar', exact: true }) }).first();
        await expect(header.getByText('Status', { exact: true })).toBeVisible();
        expect(state.lastMe?.load_metrics).toBeTruthy();
        const metrics = state.lastMe.load_metrics;
        const expected = [
          ['Fitness (CTL)', String(metrics.chronic ?? '\u2014')],
          ['Fatigue (ATL)', String(metrics.acute ?? '\u2014')],
          ['Form (TSB)', String(metrics.form ?? '\u2014')],
          ['Status', state.lastMe.load_status.label],
        ];
        const cards = [];
        const labels = [];
        for (const [label, value] of expected) {
          const card = header.getByText(label, { exact: true }).locator('..');
          await expect(card.locator('p').nth(1)).toHaveText(value);
          await expect(card).toBeVisible();
          labels.push(await card.locator('p').nth(1).evaluate(element => ({
            text: element.textContent, scroll: element.scrollWidth, client: element.clientWidth,
          })));
          cards.push(await card.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { text: element.textContent, left: rect.left, right: rect.right, width: rect.width,
              hidden: Boolean(element.closest('[aria-hidden="true"],[hidden]')), overflow: getComputedStyle(element).overflowX };
          }));
        }
        const root = await page.evaluate(() => ({ viewport: innerWidth, root: document.documentElement.scrollWidth }));
        observations.push({ width, phase, expected, ...root, cards, labels });
        await page.screenshot({ path: `../output/calendar-load-layout-${process.env.CALENDAR_LAYOUT_STAGE || 'verification'}-${width}-${phase}.png` });
        // Mobile innerWidth can itself expand with overflow. Compare against
        // the requested layout width, not the already-expanded innerWidth.
        expect.soft(root.root, `${width}px ${phase}: page has no horizontal scroll`).toBeLessThanOrEqual(width);
        for (const card of cards) {
          expect.soft(card.left, `${width}px ${phase}: ${card.text} starts inside viewport`).toBeGreaterThanOrEqual(0);
          expect.soft(card.right, `${width}px ${phase}: ${card.text} ends inside viewport`).toBeLessThanOrEqual(width);
          expect(card.hidden).toBe(false);
          expect(['hidden', 'clip'].includes(card.overflow)).toBe(false);
        }
        for (const label of labels) expect.soft(label.scroll, `${width}px ${phase}: full ${label.text} fits its card`).toBeLessThanOrEqual(label.client);
      }
    }
    expect(state.external).toEqual([]);
    expect(state.errors).toEqual([]);
  } finally {
    const output = new URL('../../output/', import.meta.url);
    await mkdir(output, { recursive: true });
    await writeFile(new URL(`calendar-load-layout-${process.env.CALENDAR_LAYOUT_STAGE || 'verification'}-${info.project.name}.json`, output), JSON.stringify(observations, null, 2));
    await f.close();
  }
});
