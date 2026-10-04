import { test, expect } from '@playwright/test';

// Shared isolated API store exercises both real page roles and persistence on
// navigation/reload. It does not claim server authorization or Supabase writes.
async function routeMessages(page, role, store) {
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    let status = 200; let body = { conversations: [], messages: [], notifications: [], unreadCount: 0 };
    if (url.pathname === '/api/me') body = {
      athlete: { id: role === 'coach' ? 'coach-owner' : 'athlete-1', name: role, onboarding_complete: true, primary_role: role, subscription_tier: 'free' },
      account: { primary_role: role, capabilities: { athlete: true, coach: role === 'coach' }, coach_profile: role === 'coach' ? { id: 'coach-1', display_name: 'Test Coach' } : null },
    };
    if (url.pathname === '/api/coach/messages') {
      if (request.method() === 'POST') {
        const payload = request.postDataJSON(); store.posts.push(payload);
        if (store.delay) await store.delay;
        if (store.fail) { status = 503; body = { error: 'Isolated failure' }; }
        else {
          store.messages.push({ id: `message-${store.messages.length}`, sender_role: role, athlete_id: 'athlete-1', message_body: payload.message_body, created_at: '2026-10-01T12:00:00Z' });
          body = { success: true };
        }
      } else body = { role, templates: { general_checkin: 'How did training feel?' }, messages: store.messages,
        conversations: store.disconnected ? [] : [{ athlete_id: 'athlete-1', athlete: { name: role === 'coach' ? 'Test Athlete' : 'Test Coach' }, unread_count: 0 }] };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}
const newStore = () => ({ messages: [], posts: [], fail: false, disconnected: false });

test('coach sends follow-up; athlete replies; both conversations survive reload', async ({ page, context }) => {
  const store = newStore(); await routeMessages(page, 'coach', store); await page.goto('/messages');
  await expect(page.getByLabel('Selected athlete')).toHaveValue('athlete-1');
  await page.getByLabel('Your message').fill('How did the easy run feel?'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('How did the easy run feel?', { exact: true })).toBeVisible();
  const athlete = await context.newPage(); await routeMessages(athlete, 'athlete', store); await athlete.goto('/messages');
  await expect(athlete.getByText('How did the easy run feel?', { exact: true })).toBeVisible();
  await athlete.getByLabel('Your message').fill('Comfortable, legs felt fresh.'); await athlete.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(athlete.getByText('Comfortable, legs felt fresh.', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('Comfortable, legs felt fresh.', { exact: true })).toBeVisible();
  expect(store.posts[0].athlete_id).toBe('athlete-1'); expect(store.posts[1].athlete_id).toBeUndefined();
  for (const view of [page, athlete]) expect(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed send preserves draft and pending send locks editing and repeat submission', async ({ page }) => {
  const store = newStore(); store.fail = true; let release;
  store.delay = new Promise(resolve => { release = resolve; });
  await routeMessages(page, 'coach', store); await page.goto('/messages');
  await page.getByLabel('Your message').fill('Keep this draft after failure.'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sending…' })).toBeDisabled(); await expect(page.getByLabel('Your message')).toBeDisabled();
  await expect(page.getByLabel('Selected athlete')).toBeDisabled(); await expect(page.getByLabel('Message purpose')).toBeDisabled();
  release(); await expect(page.locator('main [role="alert"]')).toContainText('Unable to send message');
  await expect(page.getByLabel('Your message')).toHaveValue('Keep this draft after failure.'); expect(store.posts).toHaveLength(1);
  store.fail = false; await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Keep this draft after failure.', { exact: true })).toBeVisible(); expect(store.messages).toHaveLength(1);
});

test('athlete without an active conversation cannot submit a message', async ({ page }) => {
  const store = newStore(); store.disconnected = true; await routeMessages(page, 'athlete', store); await page.goto('/messages');
  await expect(page.getByText('No active coach conversation found.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled(); expect(store.posts).toEqual([]);
});
