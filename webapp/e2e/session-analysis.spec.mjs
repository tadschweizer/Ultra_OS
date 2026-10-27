import { test, expect } from '@playwright/test';
const athlete = '11111111-1111-4111-8111-111111111111', workoutId = '44444444-4444-4444-8444-444444444444', activityId = '55555555-5555-4555-8555-555555555555';
const day = new Date().toLocaleDateString('en-CA');
async function setup(page, { assigned = false, manual = false, suggested = false, role = 'athlete' } = {}) {
  const state = { fail: false, queries: [], suggested };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let status = 200, body = { workouts: [], notes: [], events: [], comments: [], settings: {}, conversations: [], messages: [] };
    if (url.pathname === '/api/me') body = { athlete: { id: athlete, name: 'QA athlete', onboarding_complete: true, subscription_tier: 'coach_pro', primary_role: role }, account: { primary_role: role, capabilities: { athlete: true, coach: role === 'coach' }, coach_access: { eligible: true }, coach_profile: { id: 'coach' } } };
    if (url.pathname === '/api/coach/relationships') body = { relationships: [{ athlete_id: athlete, status: 'active', athlete: { name: 'QA athlete' } }] };
    if (url.pathname === '/api/planned-workouts') {
      if (route.request().method() === 'PATCH') state.suggested = false;
      const workout = { id: workoutId, athlete_id: athlete, title: 'Completed intervals', sport: 'run', workout_date: day, status: 'completed', visibility: 'athlete_visible', planned_duration_min: 40, completed_duration_min: 30, planned_distance_km: 8, completed_distance_km: 6, completed_activity_id: manual || state.suggested ? null : activityId, matched_activity: state.suggested ? { id: activityId, activity_date: day, name: 'Suggested run', sport: 'run', duration_min: 30, distance_km: 6 } : null, structure: [{ type: 'warmup', duration_min: 5, target_type: 'heart_rate', target_min: 120, target_max: 140, target_units: 'bpm' }] };
      body = route.request().method() === 'PATCH' ? { workout } : { workouts: assigned ? [workout] : [],
        activities: assigned ? [] : [{ id: activityId, name: 'Unplanned run', sport: 'run', activity_date: day, duration_min: 30, distance_km: 6, source: 'strava' }], match_activities: state.suggested ? [workout.matched_activity] : [], import_source: { strava_connected: true } };
    }
    if (url.pathname === '/api/session-analysis') {
      state.queries.push(url.search);
      if (state.fail) { status = 503; body = { error: 'Recording temporarily unavailable' }; }
      else body = { activity: manual ? null : { moving_time: 1800, distance: 6000 }, points: manual ? [] : Array.from({ length: 361 }, (_, i) => ({ t: i * 5, distance: i * 6000 / 360, speed: 3.33 + Math.sin(i / 10), hr: 130 + i % 35, power: 220 + i % 60, elevation: 1600 + Math.sin(i / 20) * 20, cadence: 85 })), laps: manual ? [] : [{ label: 'Lap 1', start: 0, end: 300 }, { label: 'Lap 2', start: 300, end: 600 }], settings: { hr_zone_2_max: 140, hr_zone_3_min: 145, hr_zone_4_min: 165 }, recording: manual ? 'No linked recording. Manual results can be compared with the plan; charts require recorded samples.' : 'Recorded samples from Strava.' };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${role === 'coach' ? '/coach/training-calendar' : '/calendar'}?athlete=${athlete}&week=${day}&${assigned ? `workout=${workoutId}` : `activity=${activityId}`}`);
  return state;
}
test('unassigned session: charts, split selection, laps, keyboard inspection and retry', async ({ page }) => {
  const state = await setup(page);
  const panel = page.getByRole('region', { name: 'Workout analysis' });
  await expect(panel.getByText('Session timeline', { exact: true })).toBeVisible();
  await expect(panel.getByRole('img')).toHaveCount(5);
  await expect(panel.getByLabel('Cadence Y axis')).toContainText('170 spm');
  await expect(panel.getByLabel('Pace Y axis')).toContainText('/mi');
  await expect(panel.getByLabel('Heart rate Y axis')).toContainText('bpm');
  await panel.getByRole('button', { name: 'Analyze split 1', exact: true }).click();
  await expect(panel.getByLabel('Selected range statistics')).toContainText('Selected range');
  await panel.getByRole('button', { name: 'Recorded laps', exact: true }).click();
  await panel.getByRole('button', { name: 'Analyze Lap 2', exact: true }).click();
  await expect(panel.getByLabel('Analysis start seconds')).toHaveValue('300');
  await panel.getByRole('button', { name: 'Full session', exact: true }).click();
  await expect(panel.getByLabel('Analysis end seconds')).toHaveValue('1800');
  await panel.getByLabel('Inspect recording', { exact: true }).focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  await expect(panel.getByText('Inspect recording at 0:05', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('dialog', { name: 'Workout details' }).evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: `output/session-analysis/unassigned-${test.info().project.name}.png` });
  state.fail = true; await page.reload(); await expect(panel.getByRole('alert')).toHaveText('Recording temporarily unavailable');
  state.fail = false; await panel.getByRole('button', { name: 'Retry analysis' }).click(); await expect(panel.getByRole('img')).toHaveCount(5);
});

for (const role of ['athlete', 'coach']) {
  test(`${role}: suggested completion waits for confirmation before requesting analysis`, async ({ page }) => {
    const state = await setup(page, { assigned: true, suggested: true, role });
    const dialog = page.getByRole('dialog', { name: 'Workout details' });
    await expect(dialog.getByRole('heading', { name: 'Confirm the activity match to analyze this workout' })).toBeVisible();
    await expect(dialog.getByText('Suggested completion', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Retry analysis' })).toHaveCount(0);
    expect(state.queries).toEqual([]);
    await page.reload();
    await expect(dialog.getByRole('heading', { name: 'Confirm the activity match to analyze this workout' })).toBeVisible();
    expect(state.queries).toEqual([]);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `output/session-analysis/suggested-${role}-${test.info().project.name}.png` });
    if (role === 'coach') {
      await expect(dialog.getByText('Ask the athlete to confirm the imported activity match.')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Confirm activity match' })).toHaveCount(0);
    } else {
      await dialog.getByRole('button', { name: 'Confirm activity match' }).click();
      await expect(dialog.getByRole('region', { name: 'Workout analysis' }).getByRole('img')).toHaveCount(5);
      expect(state.queries).toContain(`?workout_id=${workoutId}`);
    }
  });
}
test('coach assigned session compares plan and uses the same recording tools', async ({ page }) => {
  const state = await setup(page, { assigned: true, role: 'coach' });
  const panel = page.getByRole('region', { name: 'Workout analysis' });
  await expect(panel.getByRole('img')).toHaveCount(5);
  await expect(panel.getByText('Planned vs completed', { exact: true })).toBeVisible();
  await expect(panel.getByRole('row').filter({ hasText: 'Duration' })).toContainText('-10.0');
  await panel.getByRole('button', { name: 'Planned steps' }).click(); await expect(panel.getByText('warmup: heart_rate 120 –140 bpm')).toBeVisible();
  expect(await page.getByRole('dialog', { name: 'Workout details' }).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('dialog', { name: 'Workout details' }).evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: `output/session-analysis/assigned-${test.info().project.name}.png` });
  expect(state.queries[0]).toContain(`workout_id=${workoutId}`);
});
test('manual completion shows comparison and honest missing recording', async ({ page }) => {
  await setup(page, { assigned: true, manual: true });
  const panel = page.getByRole('region', { name: 'Workout analysis' });
  await expect(panel.getByText('No linked recording.', { exact: false })).toBeVisible();
  await expect(panel.getByRole('img')).toHaveCount(0);
  await expect(panel.getByRole('row').filter({ hasText: 'Duration' })).toContainText('30.0');
});
