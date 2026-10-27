// Explicit capture only. The asset is rendered from the real workout-detail UI;
// every response is fictional and intercepted, including all write endpoints.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('capture fictional session from the production component', async ({ page }) => {
  test.skip(process.env.CAPTURE_COACHING_EXAMPLE !== '1', 'Run explicitly when refreshing the public example image.');
  const athlete = '11111111-1111-4111-8111-111111111111';
  const coach = '33333333-3333-4333-8333-333333333333';
  const id = '44444444-4444-4444-8444-444444444444';
  const workout = { id, athlete_id: athlete, coach_id: coach, title: 'Monday easy run', sport: 'run', workout_date: '2026-10-19', status: 'completed', visibility: 'athlete_visible',
    updated_at: '2026-10-19T12:00:00Z', structure: [], planned_duration_min: 40, planned_distance_unit: 'km',
    completed_duration_min: 38, completed_distance_km: 6.1, athlete_rpe: 4,
    coach_instructions: 'Keep the effort comfortable enough to talk.',
    athlete_comment: 'Legs felt heavy, so I took it easier.',
    coach_feedback: 'Thanks for letting me know. Keep tomorrow easy and tell me how it feels.' };
  await page.setViewportSize({ width: 1000, height: 1600 });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = { workouts: [], notes: [], events: [], comments: [], settings: {}, conversations: [], messages: [] };
    if (path === '/api/me') data = { athlete: { id: '99999999-9999-4999-8999-999999999999', name: 'Example coach', onboarding_complete: true, subscription_tier: 'coach_pro', primary_role: 'coach' }, account: { primary_role: 'coach', capabilities: { athlete: true, coach: true }, coach_access: { eligible: true }, coach_profile: { id: coach } } };
    if (path === '/api/coach/relationships') data = { relationships: [{ athlete_id: athlete, status: 'active', athlete: { name: 'Example athlete' } }] };
    if (path === '/api/planned-workouts') data = { workouts: [workout], activities: [], match_activities: [], import_source: { strava_connected: false } };
    if (path === '/api/workout-review') data = { revision: 1, reviewed: true, request_open: false, items: [], has_more: false };
    await route.fulfill({ status: path === '/api/site-review' ? 403 : 200, json: data });
  });
  await page.goto(`/coach/training-calendar?athlete=${athlete}&week=2026-10-19&workout=${id}`);
  const detail = page.getByRole('dialog', { name: 'Workout details' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('Coach reviewed this result.', { exact: false })).toBeVisible();
  await expect(detail.getByText(/Coach: Thanks for letting me know/)).toBeVisible();
  await mkdir('public/images', { recursive: true });
  await detail.screenshot({ path: 'public/images/coaching-session-example.png' });
});
