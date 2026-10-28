import { test, expect } from '@playwright/test';

async function mockAccount(page, { coach = false, strava = false, saveFails = false, onboarding = false,
  relationships = [], calendarStravaConnected = true } = {}) {
  let invited = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let status = 200;
    let payload = { connections: [], relationships: [], protocols: [], templates: [], invitations: [],
      groups: [], requests: [], races: [], notifications: [], conversations: [], messages: [], unreadCount: 0 };
    if (path === '/api/me') payload = {
      athlete: { id: 'athlete-1', name: 'QA account', onboarding_complete: !onboarding, subscription_tier: 'free', primary_role: coach ? 'coach' : 'athlete' },
      account: { primary_role: coach ? 'coach' : 'athlete', capabilities: { athlete: true, coach },
        coach_access: { eligible: coach, reason: 'pilot' }, default_path: coach ? '/coach-command-center' : '/dashboard' },
    };
    if (path === '/api/integrations/status') payload = { strava };
    if (path === '/api/coach/relationships') payload = { relationships };
    if (path === '/api/planned-workouts') payload = { workouts: [], activities: [],
      import_source: { strava_connected: calendarStravaConnected } };
    if (path === '/api/coach/dashboard') payload = { profile: { id: 'coach-1', display_name: 'QA Coach', coach_code: 'QA-COACH' }, summary: { total_athletes: 0 } };
    if (path === '/api/coach/invitations' && route.request().method() === 'POST') {
      invited = true;
      payload = { invitation: { id: 'invite-1', email: route.request().postDataJSON().email,
        token: 'test-token', status: 'pending', delivery_status: 'skipped', expires_at: '2027-01-01' } };
    }
    if (path === '/api/onboarding') {
      payload = { athlete: { primary_role: 'athlete' }, signupRole: 'individual' };
      if (route.request().method() === 'POST' && saveFails) { status = 503; payload = { error: 'Unavailable' }; }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  return { invited: () => invited };
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('coach can reach first invitation and every mobile destination without a typed URL', async ({ page }, info) => {
  const state = await mockAccount(page, { coach: true });
  await page.goto('/account');
  const nav = info.project.name === 'mobile-chromium' ? page.getByRole('navigation', { name: 'Primary navigation' }) : page.locator('aside');
  await nav.getByRole('link', { name: info.project.name === 'mobile-chromium' ? 'Roster' : 'Coach Command Center', exact: true }).click();
  await page.getByRole('button', { name: 'Invite an athlete', exact: true }).click();
  await page.getByRole('textbox', { name: 'Athlete email' }).fill('qa.athlete@example.test');
  await page.getByRole('button', { name: 'Send invite', exact: true }).click();
  await expect.poll(state.invited).toBe(true);
  await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('link', { name: 'Manage groups' }).click();
  await expect(page).toHaveURL(/\/coach\/groups$/);
  if (info.project.name === 'mobile-chromium') {
    for (const [label, path] of [['Calendar', '/coach/training-calendar'], ['Messages', '/messages'], ['Profile', '/account']]) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await noOverflow(page);
    }
  }
});

test('connections shows unique providers and fails closed when configuration is unavailable', async ({ page }) => {
  await mockAccount(page);
  await page.goto('/connections');
  for (const provider of ['Oura', 'Ultrahuman', 'TrainingPeaks']) {
    await expect(page.locator('article').filter({ has: page.getByText(provider, { exact: true }) })).toHaveCount(1);
  }
  await expect(page.getByRole('link', { name: 'Connect', exact: true })).toHaveCount(0);
  await expect(page.getByText('Currently unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText(/2 of 3 sections|Historical workouts and key metadata imported/)).toHaveCount(0);
  await noOverflow(page);
});

test('configured Strava offers a real connect link while unfinished providers remain unavailable', async ({ page }) => {
  await mockAccount(page, { strava: true });
  await page.goto('/connections');
  await expect(page.getByRole('link', { name: 'Connect', exact: true })).toHaveAttribute('href', '/api/strava/login');
  await expect(page.locator('article').filter({ has: page.getByText('Garmin', { exact: true }) }).getByRole('link')).toHaveCount(0);
});

test('onboarding retains optional answers after a failed save', async ({ page }) => {
  await mockAccount(page, { saveFails: true, onboarding: true });
  await page.goto('/onboarding');
  await expect(page.getByText('Step 1 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Ultrarunner', exact: true }).click();
  await page.getByLabel('Usual training hours').selectOption('8-12');
  await page.getByRole('button', { name: 'Open my training' }).click();
  await expect(page.locator('main [role="alert"]')).toContainText('Your answers are still here');
  await expect(page.getByText('Step 2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ultrarunner', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await noOverflow(page);
});

test('query string alone cannot claim a Strava connection or finish onboarding', async ({ page }) => {
  await mockAccount(page, { onboarding: true });
  await page.goto('/onboarding?strava=connected');
  await expect(page.getByText('Step 1 of 2', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding\?strava=connected$/);
  await expect(page.getByText('Connected', { exact: true })).toHaveCount(0);
});

test('coach calendar explains disconnected imports without hiding stored training', async ({ page }) => {
  const relationships = [{ athlete_id: 'athlete-2', status: 'active', athlete: { name: 'Pilot Runner' } }];
  const notice = page.getByText(/hasn.t connected Strava\. Assigned workouts/);
  const calendarLoaded = () => page.waitForResponse((r) => new URL(r.url()).pathname === '/api/planned-workouts');

  await mockAccount(page, { coach: true, relationships, calendarStravaConnected: false });
  await page.goto('/coach/training-calendar');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Pilot Runner hasn’t connected Strava');
  await noOverflow(page);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockAccount(page, { coach: true, relationships, calendarStravaConnected: true });
  let loaded = calendarLoaded();
  await page.reload();
  await loaded;
  await expect(page.getByText('Loading roster…')).toBeHidden();
  await expect(notice).toHaveCount(0);

  // The athlete's own calendar never shows the coach-facing notice.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockAccount(page, { calendarStravaConnected: false });
  loaded = calendarLoaded();
  await page.goto('/calendar');
  await loaded;
  await expect(notice).toHaveCount(0);
});

const reviewRelationships = [{id:'rel-review',athlete_id:'runner-review',status:'active',athlete:{name:'Pilot Runner'},pendingReviews:1,alertLevel:'red',flagReasons:['Completed session awaits review'],flagSuggestion:'Review the completed session',daysSinceLog:1}];

for (const [level, color] of [['green','emerald'],['yellow','amber'],['red','rose']]) test(`attention card preserves ${level} status with a matching tint`, async ({page}) => {
  await mockAccount(page,{coach:true,relationships:[{...reviewRelationships[0],alertLevel:level}]});
  await page.goto('/coach-command-center');
  const card=page.getByRole('article',{name:'Pilot Runner attention summary'});
  await expect(card).toHaveClass(new RegExp(`bg-${color}-50`));
  await expect(card.getByRole('link',{name:'Review athlete',exact:true})).toBeVisible();
});

test('attention athlete selection opens review context with a keyboard-accessible link', async ({page})=>{
  await mockAccount(page,{coach:true,relationships:reviewRelationships});
  let drawerReads=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/coach/notes')drawerReads++;});
  await page.route('**/coach/athletes/runner-review',route=>route.fulfill({contentType:'text/html',body:'<h1>Pilot Runner review context</h1>'}));
  await page.goto('/coach-command-center');
  const bucket=page.getByText('Who needs attention?',{exact:true}).locator('..').locator('..');
  const athlete=bucket.getByRole('link',{name:'Pilot Runner',exact:true});
  await expect(athlete).toHaveAttribute('href','/coach/athletes/runner-review');
  await athlete.focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/coach\/athletes\/runner-review$/);
  await expect(page.getByRole('heading',{name:'Pilot Runner review context'})).toBeVisible();
  expect(drawerReads).toBe(0);
});

test('triage review links and explicit protocol action stay separate',async({page},info)=>{
  await mockAccount(page,{coach:true,relationships:reviewRelationships});await page.goto('/coach-command-center');
  const card=page.getByRole('article',{name:'Pilot Runner attention summary'});
  await expect(page.getByRole('heading',{level:1,name:'Coach command center',exact:true})).toBeVisible();
  const nudge=card.getByRole('link',{name:'Send nudge',exact:true});
  expect(await nudge.evaluate(el=>getComputedStyle(el).alignItems)).toBe('center');
  await expect(card.getByRole('link',{name:'Pilot Runner',exact:true})).toHaveAttribute('href','/coach/athletes/runner-review');
  await expect(card.getByRole('link',{name:'Review athlete',exact:true})).toHaveAttribute('href','/coach/athletes/runner-review');
  const rosterRow=page.getByRole('row').filter({hasText:'Pilot Runner'});
  await expect(rosterRow.getByRole('link',{name:'Pilot Runner',exact:true})).toHaveAttribute('href','/coach/athletes/runner-review');
  await expect(rosterRow.getByRole('button',{name:'Assign protocol',exact:true})).toBeVisible();
  await card.getByText('Why flagged:',{exact:true}).click();
  await expect(page.getByPlaceholder('Protocol name')).toHaveCount(0);
  await card.screenshot({path:`output/coach-attention/triage-${info.project.name}.png`});
  await card.getByRole('button',{name:'Assign protocol',exact:true}).click();
  await expect(page.getByPlaceholder('Protocol name')).toBeVisible();
  await noOverflow(page);
});
