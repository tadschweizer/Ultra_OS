import { test, expect } from '@playwright/test';
import { fixture, athlete } from '../tests/helpers/message-lifecycle-fixture.mjs';
import { connect } from './helpers/message-database-transport.mjs';

async function snapshot(page, name, extra = {}) {
  const history = page.getByLabel('Conversation history');
  const value = {
    ...extra,
    history: await history.innerText(),
    calendar: await page.getByRole('link', { name: 'View training calendar' }).getAttribute('href'),
    sendDisabled: await page.getByRole('button', { name: 'Send', exact: true }).isDisabled(),
    stale: await page.getByText('Showing the last loaded conversations.', { exact: true }).count(),
    alerts: await page.getByRole('alert').allTextContents(),
  };
  await test.info().attach(name, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: `../output/review137-${process.env.REVIEW137_STAGE || 'baseline'}-${name}-${test.info().project.name}.png`, fullPage: true });
}

for (const recovery of ['retry', 'focus']) {
  test(`review: initial inbox failure ${recovery} recovers desktop selection and keeps mobile list unread`, async ({ page }, info) => {
    const f = await fixture();
    try {
      await f.send(undefined, 'athlete', 'History recovered after inbox outage');
      await f.pg.exec('reset role; alter function message_inbox_summary(uuid,text) rename to qa_missing_inbox; set role service_role;');
      await connect(page, 'coach', f);
      await page.goto('/messages?mode=coach');
      await expect(page.getByRole('alert').filter({ hasText: 'Unable to load messages' }).filter({ visible: true })).toBeVisible();
      await f.pg.exec('reset role; alter function qa_missing_inbox(uuid,text) rename to message_inbox_summary; set role service_role;');
      if (recovery === 'retry') await page.getByRole('button', { name: 'Retry loading' }).filter({ visible: true }).click();
      else await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const list = page.getByRole('complementary', { name: 'Conversations' });
      await expect(list.getByRole('button', { name: /Open conversation with Runner/ })).toBeVisible();
      if (info.project.name === 'mobile-chromium') {
        await expect(page.getByRole('region', { name: 'Message thread' })).not.toBeVisible();
        expect((await f.pg.query('select count(*)::int n from coach_messages where read_at is null')).rows[0].n).toBe(1);
        await list.getByRole('button', { name: /Open conversation with Runner/ }).click();
      }
      const composer = page.getByLabel('Your message');
      await composer.fill('Reply after restored inbox');
      await expect(page.getByText('Draft saved', { exact: true })).toBeVisible();
      await snapshot(page, `initial-${recovery}`);
      await expect(page.getByLabel('Conversation history').getByText('History recovered after inbox outage', { exact: true })).toBeVisible({ timeout: 2000 });
      await expect(page.getByRole('link', { name: 'View training calendar' })).toHaveAttribute('href', `/coach/training-calendar?athlete=${athlete}`);
      await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(composer).toHaveValue('');
      expect((await f.pg.query("select count(*)::int n from coach_messages where message_body='Reply after restored inbox'")).rows[0].n).toBe(1);
    } finally { await f.close(); }
  });
}

for (const failure of ['network', '503']) {
  test(`review: ${failure} read acknowledgement failure preserves fresh inbox and retries read status`, async ({ page }) => {
    const f = await fixture(); let failRead = true, rejected = 0;
    try {
      await f.send(undefined, 'athlete', 'Loaded message despite read-status failure');
      await connect(page, 'coach', f);
      await page.route('**/api/message-center', async route => {
        const request = route.request();
        if (failRead && request.method() === 'POST' && request.postDataJSON()?.action === 'mark_read') {
          rejected += 1;
          if (failure === 'network') await route.abort('failed');
          else await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic read-status outage' }) });
        } else await route.fallback();
      });
      await page.goto(`/messages?mode=coach&athlete_id=${athlete}`);
      await expect(page.getByLabel('Conversation history').getByText('Loaded message despite read-status failure', { exact: true })).toBeVisible();
      await expect.poll(() => rejected).toBeGreaterThan(0);
      await page.getByLabel('Your message').fill('Keep this recipient draft through read retry');
      await expect(page.getByText('Draft saved', { exact: true })).toBeVisible();
      await snapshot(page, `read-${failure}`, { rejected });
      await expect(page.getByRole('alert').filter({ hasText: 'Messages loaded, but read status could not be saved. We will retry.' }).filter({ visible: true })).toBeVisible({ timeout: 2000 });
      await expect(page.getByText('Showing the last loaded conversations.', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('alert').filter({ hasText: 'Unable to load messages' })).toHaveCount(0);
      expect((await f.pg.query('select count(*)::int n from coach_messages where read_at is null')).rows[0].n).toBe(1);
      await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
      failRead = false;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect.poll(async () => (await f.pg.query('select count(*)::int n from coach_messages where read_at is null')).rows[0].n).toBe(0);
      await expect(page.getByRole('alert').filter({ hasText: 'Messages loaded, but read status' })).toHaveCount(0);
      await expect(page.getByLabel('Your message')).toHaveValue('Keep this recipient draft through read retry');
      await expect(page.getByLabel('Conversation history').locator('[data-message-id]')).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'View training calendar' })).toHaveAttribute('href', `/coach/training-calendar?athlete=${athlete}`);
    } finally { await f.close(); }
  });
}
