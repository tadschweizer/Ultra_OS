import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMO_ATHLETE_EMAIL,
  DEMO_COACH_EMAIL,
  buildDemoSeed,
  canOverrideTier,
  generateDemoPassword,
  isKnownTier,
  partitionDemoRows,
} from '../lib/adminDemo.js';
import setTierHandler from '../pages/api/admin/set-tier.js';

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('isKnownTier accepts only real tiers', () => {
  assert.equal(isKnownTier('coach'), true);
  assert.equal(isKnownTier('free'), true);
  assert.equal(isKnownTier('pro'), false);
  assert.equal(isKnownTier(''), false);
  assert.equal(isKnownTier(null), false);
});

test('canOverrideTier blocks accounts owned by an active Stripe subscription', () => {
  assert.equal(canOverrideTier(null).allowed, false);
  assert.equal(
    canOverrideTier({ stripe_subscription_id: 'sub_1', stripe_subscription_status: 'active' }).allowed,
    false,
  );
  assert.equal(
    canOverrideTier({ stripe_subscription_id: 'sub_1', stripe_subscription_status: 'trialing' }).allowed,
    false,
  );
  // Canceled subscription or no subscription at all → admin may override.
  assert.equal(
    canOverrideTier({ stripe_subscription_id: 'sub_1', stripe_subscription_status: 'canceled' }).allowed,
    true,
  );
  assert.equal(canOverrideTier({ stripe_subscription_id: null, stripe_subscription_status: null }).allowed, true);
});

test('set-tier rejects non-POST before touching the database', async () => {
  const res = makeRes();
  await setTierHandler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

test('demo passwords clear the signup minimum and never repeat', () => {
  const seen = new Set();
  for (let i = 0; i < 20; i += 1) {
    const password = generateDemoPassword();
    assert.equal(password.length >= 8, true);
    assert.equal(seen.has(password), false);
    seen.add(password);
  }
});

test('demo seed: race sits in the future and everything points at it', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  const { race, protocolAssignment } = buildDemoSeed(now);
  assert.equal(race.event_date > '2026-07-15', true);
  assert.equal(race.race_type, 'ultra');
  assert.equal(protocolAssignment.status, 'active');
  assert.equal(protocolAssignment.start_date < protocolAssignment.target_completion_date, true);
});

test('demo seed: interventions cover ~5 weeks of history with valid rows', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  const { interventions } = buildDemoSeed(now);

  assert.equal(interventions.length > 20, true);
  for (const row of interventions) {
    assert.equal(typeof row.intervention_type, 'string');
    assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/);
    // History only — nothing logged in the future.
    assert.equal(new Date(row.inserted_at).getTime() <= now.getTime(), true);
    assert.equal(typeof row.protocol_payload, 'object');
  }

  const checkIns = interventions.filter((row) => row.intervention_type === 'Workout Check-in');
  assert.equal(checkIns.length, 15);
  for (const row of checkIns) {
    // Payload was normalized against the catalog and legacy scores inferred,
    // so insights/compliance code sees the same shape as a real log.
    assert.equal(typeof row.protocol_payload.session_type, 'string');
    assert.equal(typeof row.physical_response, 'number');
    assert.equal(typeof row.subjective_feel, 'number');
  }

  // No rolling week exceeds the 3-check-ins cadence the seed advertises.
  const times = checkIns.map((row) => new Date(row.inserted_at).getTime()).sort((a, b) => a - b);
  for (const start of times) {
    const inWindow = times.filter((t) => t >= start && t < start + 7 * 86400000).length;
    assert.equal(inWindow <= 3, true);
  }
});

test('demo seed: calendar has completed history and a planned future block', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  const { plannedWorkouts } = buildDemoSeed(now);
  const today = '2026-07-15';

  const completed = plannedWorkouts.filter((w) => w.status === 'completed');
  const planned = plannedWorkouts.filter((w) => w.status === 'planned');
  assert.equal(completed.length, 6);
  assert.equal(planned.length, 6);

  for (const workout of completed) {
    assert.equal(workout.workout_date < today, true);
    assert.equal(typeof workout.completed_duration_min, 'number');
    assert.equal(workout.athlete_rpe >= 1 && workout.athlete_rpe <= 10, true);
  }
  for (const workout of planned) {
    assert.equal(workout.workout_date > today, true);
    assert.equal(workout.completed_duration_min === undefined, true);
  }
  // Every workout is coach-assigned so the coach calendar has a full view.
  assert.equal(plannedWorkouts.every((w) => w.coachAssigned === true), true);
});

test('partitionDemoRows keeps demo accounts out of health stats', () => {
  const athletes = [
    { id: 'a1', is_demo: false },
    { id: 'a2', is_demo: true },
    { id: 'a3', is_demo: false },
  ];
  const interventions = [
    { athlete_id: 'a1', intervention_type: 'Sleep Protocol' },
    { athlete_id: 'a2', intervention_type: 'Workout Check-in' },
    { athlete_id: 'a2', intervention_type: 'Heat Acclimation' },
    { athlete_id: 'a3', intervention_type: 'Gut Training' },
  ];

  const { realAthletes, realInterventions, demoIds } = partitionDemoRows(athletes, interventions);
  assert.deepEqual(realAthletes.map((a) => a.id), ['a1', 'a3']);
  assert.deepEqual(realInterventions.map((i) => i.athlete_id), ['a1', 'a3']);
  assert.deepEqual([...demoIds], ['a2']);
});

test('demo account emails are reserved-TLD addresses', () => {
  assert.match(DEMO_COACH_EMAIL, /@threshold\.test$/);
  assert.match(DEMO_ATHLETE_EMAIL, /@threshold\.test$/);
});
