import { randomBytes } from 'crypto';
import { normalizeProtocolPayload, inferLegacyScores } from './interventionCatalog.js';
import { SUBSCRIPTION_TIERS } from './subscriptionTiers.js';
import { isEntitledSubscriptionStatus } from './billingPlans.js';

/**
 * Demo sandbox helpers: admin tier override guard + seed data for the
 * demo coach/athlete pair. Pure functions live here so they can be
 * unit-tested without a database.
 */

export const DEMO_COACH_EMAIL = 'demo.coach@threshold.test';
export const DEMO_ATHLETE_EMAIL = 'demo.athlete@threshold.test';
export const DEMO_COACH_NAME = 'Demo Coach';
export const DEMO_ATHLETE_NAME = 'Demo Athlete';

const DAY_MS = 86400000;

export function isKnownTier(tier) {
  return typeof tier === 'string' && tier in SUBSCRIPTION_TIERS;
}

/**
 * Whether an admin may hand-set this athlete's subscription_tier. Accounts
 * with a live Stripe subscription are owned by the billing webhook — an
 * override would be silently reverted on the next webhook event (and could
 * desync entitlement from what the customer pays for).
 */
export function canOverrideTier(athlete) {
  if (!athlete) return { allowed: false, reason: 'Athlete not found.' };
  if (athlete.stripe_subscription_id && isEntitledSubscriptionStatus(athlete.stripe_subscription_status)) {
    return {
      allowed: false,
      reason: 'This account has an active Stripe subscription — its tier is managed by billing. Cancel the subscription first.',
    };
  }
  return { allowed: true };
}

export function generateDemoPassword() {
  // 16 hex chars + suffix keeps it easy to retype from another device while
  // clearing the 8-char minimum with room to spare.
  return `demo-${randomBytes(8).toString('hex')}`;
}

function isoDaysFromNow(days, now) {
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

function dateOnlyDaysFromNow(days, now) {
  return isoDaysFromNow(days, now).slice(0, 10);
}

function checkIn(daysAgo, now, { session, minutes, legs, energy, rpe, hr }) {
  const payload = normalizeProtocolPayload('Workout Check-in', {
    session_type: session,
    duration_minutes: minutes,
    legs_feel: legs,
    energy_feel: energy,
    perceived_effort: rpe,
    avg_hr: hr,
  });
  return {
    intervention_type: 'Workout Check-in',
    date: dateOnlyDaysFromNow(-daysAgo, now),
    inserted_at: isoDaysFromNow(-daysAgo, now),
    protocol_payload: payload,
    ...inferLegacyScores('Workout Check-in', payload),
  };
}

function protocolLog(type, daysAgo, now, payload, notes = null) {
  const normalized = normalizeProtocolPayload(type, payload);
  return {
    intervention_type: type,
    date: dateOnlyDaysFromNow(-daysAgo, now),
    inserted_at: isoDaysFromNow(-daysAgo, now),
    protocol_payload: normalized,
    notes,
    ...inferLegacyScores(type, normalized),
  };
}

/**
 * Builds every row the demo athlete needs so dashboards, insights, the
 * calendar, and the coach view all have something to show: ~5 weeks of
 * history (check-ins + protocol logs + completed workouts) and 2 weeks of
 * upcoming coach-assigned workouts pointing at a race 8 weeks out.
 *
 * Returns plain row objects WITHOUT athlete_id/coach_id — the caller stamps
 * ids on before inserting.
 */
export function buildDemoSeed(now = new Date()) {
  const race = {
    name: 'Grand Mesa 100K',
    event_date: dateOnlyDaysFromNow(56, now),
    race_type: 'ultra',
    distance_miles: 62,
    elevation_gain_ft: 9500,
    location: 'Grand Mesa, CO',
    surface: 'trail',
    notes: 'Demo goal race seeded by the admin sandbox.',
  };

  const interventions = [];
  // 5 weeks of history. Weekly rhythm: 3 check-ins (interval Tue, tempo Thu,
  // long run Sat) + sauna heat block + gut training on the long run.
  for (let week = 0; week < 5; week += 1) {
    const base = week * 7;
    interventions.push(
      checkIn(base + 2, now, { session: 'Intervals', minutes: 55, legs: 6 + (week % 2), energy: 7, rpe: 8, hr: 158 }),
      checkIn(base + 4, now, { session: 'Tempo / Threshold', minutes: 70, legs: 6, energy: 6 + (week % 3), rpe: 7, hr: 152 }),
      checkIn(base + 6, now, { session: 'Long Run', minutes: 150 + week * 10, legs: 5, energy: 6, rpe: 6, hr: 141 }),
      protocolLog('Heat Acclimation', base + 3, now, {
        method: 'Sauna', temperature_f: 180, duration_minutes: 25, response: 6 + (week % 3),
      }),
      protocolLog('Gut Training', base + 6, now, {
        carb_target_g_per_hr: 80, carb_actual_g_per_hr: 70 + week * 2, session_duration_hours: 2.5, gi_response: 5 + (week % 4),
      }, 'Practiced race fueling on the long run.'),
    );
  }
  interventions.push(
    protocolLog('Sodium Bicarbonate - Loading Protocol', 9, now, {
      dose: '0.3 g/kg', timing_minutes_before_effort: 90, delivery: 'Capsules', gi_response: 7, performance_feel: 8,
    }),
  );

  const plannedWorkouts = [];
  // Past 2 weeks: completed, coach-assigned workouts (matches the check-in cadence).
  for (let week = 0; week < 2; week += 1) {
    const base = week * 7;
    plannedWorkouts.push(
      {
        workout_date: dateOnlyDaysFromNow(-(base + 2), now),
        sport: 'run', title: 'Hill intervals 8×90s', coachAssigned: true,
        description: '8×90s uphill hard, jog-down recovery. 15min warm-up/down.',
        planned_duration_min: 55, planned_distance_km: 10,
        status: 'completed', completed_duration_min: 57, completed_distance_km: 10.4, athlete_rpe: 8,
        athlete_comment: 'Legs came around after rep 3.',
      },
      {
        workout_date: dateOnlyDaysFromNow(-(base + 4), now),
        sport: 'run', title: 'Tempo 3×15min', coachAssigned: true,
        description: '3×15min at threshold, 4min float between.',
        planned_duration_min: 70, planned_distance_km: 14,
        status: 'completed', completed_duration_min: 72, completed_distance_km: 13.6, athlete_rpe: 7,
      },
      {
        workout_date: dateOnlyDaysFromNow(-(base + 6), now),
        sport: 'run', title: `Long run ${150 + week * 10}min`, coachAssigned: true,
        description: 'Steady mountain long run, fuel at 80g carbs/hr.',
        planned_duration_min: 150 + week * 10, planned_distance_km: 24,
        status: 'completed', completed_duration_min: 155 + week * 10, completed_distance_km: 24.8, athlete_rpe: 6,
      },
    );
  }
  // Next 2 weeks: upcoming coach-assigned plan.
  const upcoming = [
    [1, 'Recovery run 40min', 'Easy conversational pace, soft surface.', 40, 7],
    [3, 'Hill intervals 10×90s', 'Progress to 10 reps. Same recovery.', 60, 11],
    [5, 'Tempo 2×20min', '2×20min at threshold, 5min float.', 70, 14],
    [7, 'Long run 170min', 'Rolling trail, practice race fueling again.', 170, 26],
    [10, 'Hill intervals 10×2min', 'Longer reps this week — stay smooth.', 65, 11],
    [13, 'Long run 180min', 'Biggest long run of the block.', 180, 28],
  ];
  for (const [inDays, title, description, minutes, km] of upcoming) {
    plannedWorkouts.push({
      workout_date: dateOnlyDaysFromNow(inDays, now),
      sport: 'run', title, description, coachAssigned: true,
      planned_duration_min: minutes, planned_distance_km: km, status: 'planned',
    });
  }

  const protocolAssignment = {
    intervention_type: 'Heat Acclimation',
    start_date: dateOnlyDaysFromNow(-21, now),
    target_completion_date: dateOnlyDaysFromNow(21, now),
    frequency_type: 'weekly',
    frequency_details: { sessions_per_week: 2 },
    planned_sessions: 12,
    note: 'Sauna block ahead of Grand Mesa — 2×25min per week, build tolerance gradually.',
    status: 'active',
  };

  const settings = {
    resting_hr: 44,
    max_hr: 188,
    body_weight_lb: 152,
    typical_sleep_hours: 7.5,
    normal_long_run_carb_g_per_hr: 75,
    sodium_target_mg_per_hr: 600,
    fluid_target_ml_per_hr: 550,
    hr_zone_1_min: 95, hr_zone_1_max: 125,
    hr_zone_2_min: 126, hr_zone_2_max: 145,
    hr_zone_3_min: 146, hr_zone_3_max: 160,
    hr_zone_4_min: 161, hr_zone_4_max: 172,
    hr_zone_5_min: 173, hr_zone_5_max: 188,
  };

  return { race, interventions, plannedWorkouts, protocolAssignment, settings };
}

/**
 * Splits a full roster + interventions into real vs demo so /admin can badge
 * demo rows while keeping them out of the data-health stats.
 */
export function partitionDemoRows(athletes, interventions) {
  const demoIds = new Set(athletes.filter((a) => a.is_demo).map((a) => a.id));
  return {
    realAthletes: athletes.filter((a) => !a.is_demo),
    realInterventions: interventions.filter((i) => !demoIds.has(i.athlete_id)),
    demoIds,
  };
}
