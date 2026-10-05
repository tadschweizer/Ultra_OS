import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const athleteId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
async function setup(page, { coach = false } = {}) {
  const day = new Date().toLocaleDateString('en-CA');
  const state = { fail: false, writes: [], acknowledgements: [], messages: [],
    workouts: [{ id: 'workout-1', title: 'Easy run', sport: 'run', workout_date: day, status: 'planned', planned_duration_min: 60, planned_distance_unit: 'km', planned_distance_km: 10, structure: [] }] };
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    let status = 200; let data = { notes: [], events: [], comments: [], settings: {}, workouts: [], messages: [], conversations: [] };
    if (url.pathname === '/api/me') data = { athlete: { id: athleteId, name: 'QA athlete', onboarding_complete: true, subscription_tier: 'free', primary_role: coach ? 'coach' : 'athlete' }, account: { primary_role: coach ? 'coach' : 'athlete', capabilities: { athlete: true, coach } } };
    if (url.pathname === '/api/planned-workouts') {
      if (request.method() === 'GET') data = { workouts: state.workouts, activities: [] };
      else {
        const body = request.postDataJSON(); state.writes.push(body);
        if (state.fail) { status = 503; data = { error: 'Save unavailable. Please retry.' }; }
        else if (request.method() === 'PATCH') { Object.assign(state.workouts[0], body); data = { workout: state.workouts[0] }; }
        else { const workout = { ...body, id: 'new-workout' }; state.workouts.push(workout); data = { workout }; }
      }
    }
    if (url.pathname === '/api/coach/messages') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); state.writes.push(body);
        if (state.fail) { status=503; data={error:'Unavailable'}; }
        else { const message = { id: body.client_message_id, athlete_id: body.athlete_id || athleteId, sender_role: coach ? 'coach' : 'athlete', message_body: body.message_body, created_at: new Date().toISOString() }; state.messages.push(message); data={message}; }
      } else data = { role: coach ? 'coach' : 'athlete', templates: { general_checkin: 'How are you?' }, conversations: [
        { athlete_id: athleteId, athlete: { name: 'First athlete' }, unread_count: 1 },
        ...(coach ? [{ athlete_id: secondId, athlete: { name: 'Second athlete' }, unread_count: 0 }] : []),
      ], messages: url.searchParams.has('before') ? state.older || [] : state.messages.filter(m => m.athlete_id === (url.searchParams.get('athlete_id') || athleteId)), next_cursor: state.older?.length && !url.searchParams.has('before') ? 'older-page' : null };
    }
    if (url.pathname === '/api/message-center') {
      if (request.method() === 'POST') { state.acknowledgements.push(request.postDataJSON()); data={success:true}; }
      else data={has_messaging:true,role:coach?'coach':'athlete',unread_total:1,workout_threads:[],conversations:[{athlete_id:athleteId,name:'First athlete',unread:1}]};
    }
    await route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) });
  });
  return state;
}

test('completion keeps unknown actuals blank, recovers from failure, permits correction and undo', async ({ page }, info) => {
  const state = await setup(page); await page.goto('/calendar?workout=workout-1');
  const dialog = page.getByRole('dialog', { name:'Workout details' });
  await expect(dialog).toBeVisible();
  const accessibility=await new AxeBuilder({ page }).include('[aria-label="Workout details"]').withTags(['wcag2a','wcag2aa']).disableRules(['color-contrast']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({path:`../output/p0-daily-loop-${info.project.name}.png`});
  await expect(dialog.getByLabel('Actual duration in minutes')).toHaveValue('');
  await expect(dialog.getByLabel('Actual distance in km')).toHaveValue('');
  await dialog.getByLabel('Actual duration in minutes').fill('20');
  state.fail = true; await dialog.getByRole('button',{name:'Mark completed',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Save unavailable');
  await expect(dialog.getByLabel('Actual duration in minutes')).toHaveValue('20');
  state.fail = false; await dialog.getByRole('button',{name:'Mark completed',exact:true}).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved.');
  expect(state.workouts[0].completed_distance_km).toBeNull();
  await dialog.getByLabel('Actual duration in minutes').fill('25');
  await dialog.getByRole('button',{name:'Save correction',exact:true}).click();
  await expect.poll(()=>state.workouts[0].completed_duration_min).toBe(25);
  await dialog.getByRole('button',{name:'Undo completion / skip'}).click();
  await expect.poll(()=>state.workouts[0].status).toBe('planned');
  expect(state.workouts[0].completed_duration_min).toBeNull();
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('athlete can log an unplanned workout from the mobile entry point', async ({ page }) => {
  const state=await setup(page); await page.goto('/calendar?log=1');
  const dialog=page.getByRole('dialog',{name:'Workout editor'});
  await dialog.getByLabel('Workout title',{exact:true}).fill('Lunch walk');
  await dialog.getByLabel('Actual duration (min)',{exact:true}).fill('18');
  await dialog.getByRole('button',{name:'Save completed workout'}).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[0].status).toBe('completed'); expect(state.writes[0].completed_duration_min).toBe(18);
  expect(state.writes[0].planned_duration_min).toBeNull();
});

test('recipient drafts stay separate and failed retries reuse the same message identity', async ({ page }) => {
  const state=await setup(page,{coach:true}); await page.goto('/messages');
  await page.getByLabel('Your message').fill('First draft');
  await page.getByLabel('Selected athlete').selectOption(secondId);
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await page.getByLabel('Your message').fill('Second draft');
  await page.getByLabel('Selected athlete').selectOption(athleteId);
  await expect(page.getByLabel('Your message')).toHaveValue('First draft');
  state.fail=true; await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('main [role="alert"]')).toContainText('Unable to send');
  state.fail=false; await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByLabel('Your message')).toHaveValue('');
  expect(state.writes[0].client_message_id).toBe(state.writes[1].client_message_id);
  expect(state.messages).toHaveLength(1);
});

test('incoming reply refreshes without reload and acknowledges only the displayed messages', async ({ page }) => {
  const state=await setup(page,{coach:true}); await page.goto('/messages');
  await expect(page.getByLabel('Selected athlete')).toHaveValue(athleteId);
  state.messages.push({id:messageId, athlete_id:athleteId, sender_role:'athlete',message_body:'Legs feel good today',created_at:new Date().toISOString()});
  await expect(page.getByText('Legs feel good today',{exact:true})).toBeVisible({timeout:6500});
  await expect.poll(()=>state.acknowledgements.some(a=>a.message_ids?.includes(messageId))).toBe(true);
  expect(state.acknowledgements.at(-1).message_ids).toEqual([messageId]);
});

test('floating conversation opens the canonical inbox with the selected recipient', async ({ page }) => {
  await setup(page,{coach:true}); await page.goto('/calendar');
  await page.getByRole('button',{name:/Messages \(1 unread\)/}).click();
  await page.getByRole('button',{name:/First athlete/}).click();
  await expect(page).toHaveURL(new RegExp(`/messages\\?athlete_id=${athleteId}`));
  await expect(page.getByLabel('Selected athlete')).toHaveValue(athleteId);
});


test('older history remains visible after automatic refresh', async ({ page }) => {
  const state=await setup(page,{coach:true});
  state.messages=[{id:messageId,athlete_id:athleteId,sender_role:'coach',message_body:'Recent reply',created_at:'2026-10-04T12:00:00Z'}];
  state.older=[{id:'older',athlete_id:athleteId,sender_role:'coach',message_body:'Older training discussion',created_at:'2026-09-01T12:00:00Z'}];
  await page.goto('/messages');
  await page.getByRole('button',{name:'Load older messages'}).click();
  await expect(page.getByText('Older training discussion',{exact:true})).toBeVisible();
  state.messages.push({id:'latest',athlete_id:athleteId,sender_role:'athlete',message_body:'New while reading history',created_at:'2026-10-04T13:00:00Z'});
  await expect(page.getByText('New while reading history',{exact:true})).toBeVisible({timeout:6500});
  await expect(page.getByText('Older training discussion',{exact:true})).toBeVisible();
});

test('Today exposes planned training and coach feedback; phone navigation opens logging', async ({ page }, info) => {
  const state=await setup(page);
  state.messages=[{id:messageId,athlete_id:athleteId,sender_role:'coach',message_body:'Keep the run relaxed today.',created_at:new Date().toISOString()}];
  await page.goto('/dashboard');
  const today=page.getByRole('region',{name:"Today's training"});
  await expect(today.getByText('Easy run',{exact:true})).toBeVisible();
  await expect(today.getByText('Keep the run relaxed today.')).toBeVisible();
  if(info.project.name==='mobile-chromium') {
    const nav=page.getByRole('navigation',{name:'Primary navigation'});
    for(const name of ['Today','Calendar','Log workout','Messages','Profile']) await expect(nav.getByRole('link',{name,exact:true})).toBeVisible();
    await nav.getByRole('link',{name:'Log workout',exact:true}).click();
  } else await today.getByRole('link',{name:'Log workout'}).click();
  const dialog=page.getByRole('dialog',{name:'Workout editor'});
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
});

test('triage template opens once and does not refill the composer after sending', async ({ page }) => {
  await setup(page, { coach: true });
  await page.goto(`/messages?athlete_id=${athleteId}&template_key=general_checkin`);
  await expect(page.getByLabel('Your message')).toHaveValue('How are you?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('How are you?', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Your message')).toHaveValue('');
});
