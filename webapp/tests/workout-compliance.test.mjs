import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compliancePct,
  complianceStatus,
  decorateWorkoutsWithCompliance,
  estimateTss,
  matchActivitiesToWorkouts,
  summarizeStructure,
  summarizeWeek,
} from '../lib/workoutCompliance.js';

test('summarizeStructure honors repeats and sums duration/distance', () => {
  const structure = [
    { type: 'warmup', repeat: 1, duration_min: 15 },
    { type: 'work', repeat: 4, duration_min: 8, distance_km: 2 },
    { type: 'recovery', repeat: 4, duration_min: 2 },
    { type: 'cooldown', repeat: 1, duration_min: 10 },
  ];
  const totals = summarizeStructure(structure);
  assert.equal(totals.durationMin, 65);
  assert.equal(totals.distanceKm, 8);
});

test('estimateTss scores interval work above easy volume', () => {
  const easyHour = estimateTss([{ type: 'work', repeat: 1, duration_min: 60, intensity: 'easy' }]);
  const thresholdHour = estimateTss([{ type: 'work', repeat: 1, duration_min: 60, intensity: 'threshold' }]);
  assert.ok(thresholdHour > easyHour);
  // Rest steps contribute nothing.
  const withRest = estimateTss([
    { type: 'work', repeat: 1, duration_min: 60, intensity: 'threshold' },
    { type: 'rest', repeat: 1, duration_min: 60 },
  ]);
  assert.equal(withRest, thresholdHour);
  // Falls back to a moderate-intensity estimate when unstructured.
  assert.equal(estimateTss([], 60), Math.round(0.7 ** 2 * 100));
  assert.equal(estimateTss([], null), null);
});

test('compliancePct compares duration first, then distance', () => {
  assert.equal(compliancePct({ planned_duration_min: 60 }, { duration_min: 54 }), 90);
  assert.equal(compliancePct({ planned_distance_km: 10 }, { distance_km: 5, duration_min: 0 }), 50);
  assert.equal(compliancePct({}, { duration_min: 45 }), null);
});

test('complianceStatus follows the green/yellow/red bands', () => {
  const today = new Date('2026-06-11T12:00:00Z');
  const base = { workout_date: '2026-06-10', planned_duration_min: 60, status: 'completed' };
  assert.equal(complianceStatus({ ...base, completed_duration_min: 60 }, { today }), 'green');
  assert.equal(complianceStatus({ ...base, completed_duration_min: 40 }, { today }), 'yellow');
  assert.equal(complianceStatus({ ...base, completed_duration_min: 20 }, { today }), 'red');
  assert.equal(complianceStatus({ ...base, completed_duration_min: 85 }, { today }), 'yellow'); // 142%
  assert.equal(complianceStatus({ ...base, completed_duration_min: 120 }, { today }), 'red'); // 200%
  // Skipped and missed-in-the-past are red; future plans are neutral.
  assert.equal(complianceStatus({ workout_date: '2026-06-10', status: 'skipped' }, { today }), 'red');
  assert.equal(complianceStatus({ workout_date: '2026-06-01', status: 'planned' }, { today }), 'red');
  assert.equal(complianceStatus({ workout_date: '2026-06-20', status: 'planned' }, { today }), 'none');
});

test('matchActivitiesToWorkouts pairs same-day activities by closest duration', () => {
  const workouts = [
    { id: 'long', workout_date: '2026-06-08', planned_duration_min: 120 },
    { id: 'short', workout_date: '2026-06-08', planned_duration_min: 30 },
  ];
  const activities = [
    { id: 'a1', start_date: '2026-06-08T07:00:00Z', moving_time: 7200 }, // 120min
    { id: 'a2', start_date: '2026-06-08T17:00:00Z', moving_time: 1800 }, // 30min
  ];
  const matches = matchActivitiesToWorkouts(workouts, activities);
  assert.equal(matches.get('long').id, 'a1');
  assert.equal(matches.get('short').id, 'a2');
});

test('decorateWorkoutsWithCompliance marks matched plans as completed with a pct', () => {
  const today = new Date('2026-06-11T12:00:00Z');
  const [decorated] = decorateWorkoutsWithCompliance(
    [{ id: 'w1', workout_date: '2026-06-09', planned_duration_min: 60, status: 'planned' }],
    [{ id: 'a1', start_date: '2026-06-09T06:00:00Z', moving_time: 3600, distance: 12000 }],
    { today }
  );
  assert.equal(decorated.status, 'completed');
  assert.equal(decorated.completed_duration_min, 60);
  assert.equal(decorated.completed_distance_km, 12);
  assert.equal(decorated.compliance_pct, 100);
  assert.equal(decorated.compliance_status, 'green');
});

test('summarizeWeek rolls up planned vs completed totals', () => {
  const summary = summarizeWeek([
    { planned_duration_min: 60, planned_distance_km: 10, planned_tss: 50, status: 'completed', completed_duration_min: 60, completed_distance_km: 10 },
    { planned_duration_min: 40, planned_distance_km: 6, planned_tss: 30, status: 'planned' },
  ]);
  assert.equal(summary.plannedDurationMin, 100);
  assert.equal(summary.completedDurationMin, 60);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.compliancePct, 60);
});

// ── summarizeReconciliationWindow ────────────────────────────────────────────

test('reconciliation window: empty inputs produce an empty summary', async () => {
  const { summarizeReconciliationWindow } = await import('../lib/workoutCompliance.js');
  const summary = summarizeReconciliationWindow([], [], { start: '2026-07-06', end: '2026-07-12' });
  assert.equal(summary.plannedCount, 0);
  assert.equal(summary.completedCount, 0);
  assert.equal(summary.unplannedActivities.length, 0);
  assert.equal(summary.avgCompliancePct, null);
  assert.deepEqual(summary.days, []);
});

test('reconciliation window: matches, misses, upcoming, and unplanned', async () => {
  const { summarizeReconciliationWindow } = await import('../lib/workoutCompliance.js');
  const today = new Date('2026-07-09T12:00:00');
  const workouts = [
    // Monday: planned 60min, a 58min run synced same day → completed, ~97%
    { id: 'w1', workout_date: '2026-07-06', sport: 'run', status: 'planned', planned_duration_min: 60 },
    // Tuesday: planned, no activity, in the past → missed
    { id: 'w2', workout_date: '2026-07-07', sport: 'run', status: 'planned', planned_duration_min: 45 },
    // Friday: planned, in the future → upcoming
    { id: 'w3', workout_date: '2026-07-10', sport: 'run', status: 'planned', planned_duration_min: 30 },
    // Outside the window → ignored entirely
    { id: 'w4', workout_date: '2026-06-01', sport: 'run', status: 'planned', planned_duration_min: 90 },
  ];
  const activities = [
    { id: 101, start_date: '2026-07-06T07:30:00Z', moving_time: 58 * 60, distance: 12000 },
    // Wednesday ride with no plan → unplanned
    { id: 102, start_date: '2026-07-08T17:00:00Z', moving_time: 40 * 60, distance: 20000 },
    // Outside window → ignored
    { id: 103, start_date: '2026-06-02T07:00:00Z', moving_time: 30 * 60 },
  ];

  const summary = summarizeReconciliationWindow(workouts, activities, {
    start: '2026-07-06', end: '2026-07-12', today,
  });

  assert.equal(summary.plannedCount, 3);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.missedCount, 1);
  assert.equal(summary.upcomingCount, 1);
  assert.equal(summary.unplannedActivities.length, 1);
  assert.equal(summary.unplannedActivities[0].id, 102);
  assert.equal(summary.avgCompliancePct, 97);
  assert.deepEqual(summary.days.map((d) => d.key), ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-10']);
});

test('reconciliation window: persisted completed_activity_id is not double-counted as unplanned', async () => {
  const { summarizeReconciliationWindow } = await import('../lib/workoutCompliance.js');
  const today = new Date('2026-07-09T12:00:00');
  const workouts = [
    {
      id: 'w1', workout_date: '2026-07-06', sport: 'run', status: 'completed',
      planned_duration_min: 60, completed_duration_min: 61,
      completed_activity_id: '101', // stored as text; activity ids are numbers
    },
  ];
  const activities = [{ id: 101, start_date: '2026-07-06T07:30:00Z', moving_time: 61 * 60 }];
  const summary = summarizeReconciliationWindow(workouts, activities, {
    start: '2026-07-06', end: '2026-07-12', today,
  });
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.unplannedActivities.length, 0);
});

test('reconciliation window: evening local-time activity stays on its calendar day', async () => {
  const { summarizeReconciliationWindow } = await import('../lib/workoutCompliance.js');
  const today = new Date('2026-07-09T12:00:00');
  const workouts = [
    { id: 'w1', workout_date: '2026-07-06', sport: 'run', status: 'planned', planned_duration_min: 60 },
  ];
  // start_date given as a local-time string (no Z): 8pm on the planned day.
  const activities = [{ id: 201, start_date: '2026-07-06T20:00:00', moving_time: 60 * 60 }];
  const summary = summarizeReconciliationWindow(workouts, activities, {
    start: '2026-07-06', end: '2026-07-12', today,
  });
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.unplannedActivities.length, 0);
});
