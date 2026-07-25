import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_COMMENT_LENGTH,
  attachAuthorNames,
  collectIds,
  parseSubject,
  validateCommentBody,
} from '../lib/workoutComments.js';
import { formatPace, formatSpeed, formatTempo, isSpeedSport } from '../lib/activityFormat.js';

const WORKOUT_ID = '22222222-2222-4222-8222-222222222222';
const ACTIVITY_ID = '33333333-3333-4333-8333-333333333333';
const ATHLETE_ID = '44444444-4444-4444-8444-444444444444';
const COACH_ID = '55555555-5555-4555-8555-555555555555';

// ─── Subject parsing ─────────────────────────────────────────────────────────

test('a workout thread is keyed on workout_id', () => {
  const result = parseSubject({ workout_id: WORKOUT_ID });

  assert.equal(result.workoutId, WORKOUT_ID);
  assert.equal(result.activityId, null);
  assert.equal(result.error, null);
});

test('an activity thread is keyed on activity_id', () => {
  const result = parseSubject({ activity_id: ACTIVITY_ID });

  assert.equal(result.activityId, ACTIVITY_ID);
  assert.equal(result.workoutId, null);
  assert.equal(result.error, null);
});

// The POST body used planned_workout_id while GET used workout_id, so the
// alias has to keep working or every existing caller breaks.
test('planned_workout_id is accepted as an alias for workout_id', () => {
  const result = parseSubject({ planned_workout_id: WORKOUT_ID });

  assert.equal(result.workoutId, WORKOUT_ID);
  assert.equal(result.error, null);
});

test('naming both subjects is rejected rather than silently picking one', () => {
  const result = parseSubject({ workout_id: WORKOUT_ID, activity_id: ACTIVITY_ID });

  assert.match(result.error, /not both/);
  assert.equal(result.workoutId, null);
  assert.equal(result.activityId, null);
});

test('naming no subject is rejected', () => {
  assert.match(parseSubject({}).error, /required/);
});

test('a blank or non-string id counts as absent', () => {
  assert.match(parseSubject({ workout_id: '   ' }).error, /required/);
  assert.match(parseSubject({ workout_id: 12345 }).error, /required/);
});

test('surrounding whitespace is trimmed off an id', () => {
  assert.equal(parseSubject({ activity_id: `  ${ACTIVITY_ID} ` }).activityId, ACTIVITY_ID);
});

// ─── Body validation ─────────────────────────────────────────────────────────

test('a comment body is trimmed', () => {
  const result = validateCommentBody('  Great session!  ');

  assert.equal(result.body, 'Great session!');
  assert.equal(result.error, null);
});

test('a whitespace-only comment is rejected', () => {
  assert.match(validateCommentBody('   \n  ').error, /required/);
  assert.match(validateCommentBody('').error, /required/);
  assert.match(validateCommentBody(undefined).error, /required/);
});

test('a comment at the length limit is accepted and one past it is not', () => {
  assert.equal(validateCommentBody('a'.repeat(MAX_COMMENT_LENGTH)).error, null);
  assert.match(validateCommentBody('a'.repeat(MAX_COMMENT_LENGTH + 1)).error, /or fewer/);
});

// ─── Author naming ───────────────────────────────────────────────────────────

const names = {
  athleteNames: new Map([[ATHLETE_ID, 'Tad Schweizer']]),
  coachNames: new Map([[COACH_ID, 'Cory Keehn']]),
};

test('a comment is attributed to the athlete who wrote it', () => {
  const [comment] = attachAuthorNames(
    [{ id: '1', sender_role: 'athlete', author_athlete_id: ATHLETE_ID, coach_id: null }],
    names,
  );

  assert.equal(comment.author_name, 'Tad Schweizer');
});

// A coach writes from their own athlete account, so the author lookup must win
// over the coach profile's display name.
test('a coach comment is attributed to the account that wrote it', () => {
  const [comment] = attachAuthorNames(
    [{ id: '1', sender_role: 'coach', author_athlete_id: ATHLETE_ID, coach_id: COACH_ID }],
    names,
  );

  assert.equal(comment.author_name, 'Tad Schweizer');
});

test('a coach comment written before authorship was recorded falls back to the profile name', () => {
  const [comment] = attachAuthorNames(
    [{ id: '1', sender_role: 'coach', author_athlete_id: null, coach_id: COACH_ID }],
    names,
  );

  assert.equal(comment.author_name, 'Cory Keehn');
});

test('an unresolvable author still renders as its role', () => {
  const [athlete, coach] = attachAuthorNames(
    [
      { id: '1', sender_role: 'athlete', author_athlete_id: null, coach_id: null },
      { id: '2', sender_role: 'coach', author_athlete_id: null, coach_id: null },
    ],
    names,
  );

  assert.equal(athlete.author_name, 'Athlete');
  assert.equal(coach.author_name, 'Coach');
});

test('attaching names leaves the original comments untouched', () => {
  const original = { id: '1', sender_role: 'athlete', author_athlete_id: ATHLETE_ID, coach_id: null };
  attachAuthorNames([original], names);

  assert.equal(original.author_name, undefined);
});

test('collectIds returns each id once and drops nulls', () => {
  const ids = collectIds(
    [{ coach_id: COACH_ID }, { coach_id: COACH_ID }, { coach_id: null }, {}],
    'coach_id',
  );

  assert.deepEqual(ids, [COACH_ID]);
});

// ─── Pace and speed ──────────────────────────────────────────────────────────

// 11.0 mi (17.70274 km) held at exactly 8:16/mi takes 90.9333 min.
test('pace matches a hand-computed value for a known run', () => {
  assert.equal(formatPace(17.70274, 90.9333, 'mi'), '8:16 /mi');
});

test('pace is reported per kilometre when the athlete prefers km', () => {
  assert.equal(formatPace(10, 50, 'km'), '5:00 /km');
});

// Rounding 59.6s up must carry into the minute, not print "7:60".
test('a pace rounding up to a full minute carries into the minute', () => {
  const pace = formatPace(1, 7.9999444, 'km');

  assert.equal(pace, '8:00 /km');
  assert.doesNotMatch(pace, /:60/);
});

test('speed is reported in mph or km/h', () => {
  assert.equal(formatSpeed(40, 60, 'km'), '40 km/h');
  assert.equal(formatSpeed(32.1868, 60, 'mi'), '20 mph');
});

test('rides read as speed and runs read as pace', () => {
  assert.equal(formatTempo('ride', 40, 60, 'km'), '40 km/h');
  assert.equal(formatTempo('run', 10, 50, 'km'), '5:00 /km');
});

test('sport matching for speed is case-insensitive and tolerates a missing sport', () => {
  assert.equal(isSpeedSport('Ride'), true);
  assert.equal(isSpeedSport('RUN'), false);
  assert.equal(isSpeedSport(null), false);
});

// A manual entry or a stopped-clock row would otherwise divide by zero.
test('pace and speed are null when distance or time is missing or zero', () => {
  for (const [distance, duration] of [[null, 50], [10, null], [0, 50], [10, 0], [-5, 50]]) {
    assert.equal(formatPace(distance, duration, 'mi'), null);
    assert.equal(formatSpeed(distance, duration, 'mi'), null);
  }
});

test('pace and speed are null for non-numeric input', () => {
  assert.equal(formatPace('not a number', 50, 'mi'), null);
  assert.equal(formatSpeed(10, 'not a number', 'mi'), null);
});
