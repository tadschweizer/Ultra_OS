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
