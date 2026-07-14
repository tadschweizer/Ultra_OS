import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTrainingResponseCorrelations,
  buildCheckInTimeSeries,
  buildCheckInSummary,
} from '../lib/trainingInsights.js';

// Fixtures mirror production shapes: scores arrive as STRINGS in protocol_payload.
function checkIn(date, { legs = 7, energy = 7 } = {}) {
  return {
    intervention_type: 'Workout Check-in',
    date,
    protocol_payload: { legs_feel: String(legs), energy_feel: String(energy) },
  };
}

function intervention(type, date) {
  return { intervention_type: type, date };
}

// Paired days: intervention one day, check-in the next; pairs spaced 4 days
// apart so no check-in sits in another pair's 48h window.
function pairedSeries(type, startDate, count, legs) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const interventionDay = new Date(start.getTime() + i * 4 * 86400000);
    const checkInDay = new Date(interventionDay.getTime() + 86400000);
    rows.push(intervention(type, interventionDay.toISOString().slice(0, 10)));
    rows.push(checkIn(checkInDay.toISOString().slice(0, 10), { legs }));
  }
  return rows;
}

function soloCheckIns(startDate, count, legs) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const day = new Date(start.getTime() + i * 4 * 86400000);
    rows.push(checkIn(day.toISOString().slice(0, 10), { legs }));
  }
  return rows;
}

// ─── buildTrainingResponseCorrelations ───────────────────────────────────────

test('below threshold: 3 check-ins yields no correlations and needsMore of 1', () => {
  const result = buildTrainingResponseCorrelations(soloCheckIns('2025-03-01', 3, 7));
  assert.deepEqual(result.correlations, []);
  assert.equal(result.checkInCount, 3);
  assert.equal(result.needsMore, 1);
});

test('positive correlation: sauna days score ~3 points higher on legs', () => {
  const data = [
    ...pairedSeries('Sauna', '2025-03-01', 4, 9),
    ...soloCheckIns('2025-04-01', 4, 6),
  ];
  const result = buildTrainingResponseCorrelations(data);
  assert.equal(result.correlations.length, 1);
  const card = result.correlations[0];
  assert.equal(card.interventionType, 'Sauna');
  assert.equal(card.metric, 'legs');
  assert.equal(card.positive, true);
  assert.ok(Math.abs(card.delta - 3) <= 0.1, `delta ${card.delta} should be ~+3`);
  assert.equal(card.withCount, 4);
  assert.equal(card.withoutCount, 4);
});

test('delta below MIN_DELTA (0.4) produces no card', () => {
  const withSauna = pairedSeries('Sauna', '2025-03-01', 4, 7);
  // Without-group averages 7.25 → |delta| ≈ 0.2 after rounding.
  const without = [
    checkIn('2025-04-01', { legs: 7 }),
    checkIn('2025-04-05', { legs: 7 }),
    checkIn('2025-04-09', { legs: 8 }),
    checkIn('2025-04-13', { legs: 7 }),
  ];
  const result = buildTrainingResponseCorrelations([...withSauna, ...without]);
  assert.deepEqual(result.correlations, []);
});

test('group-size gate: each side needs MIN_GROUP_SIZE of 3', () => {
  const data = [
    ...pairedSeries('Sauna', '2025-03-01', 6, 9),
    ...soloCheckIns('2025-05-01', 2, 5),
  ];
  const result = buildTrainingResponseCorrelations(data);
  assert.deepEqual(result.correlations, []);
});

test('48-hour window: 3 days before does not tag; exactly 2 days (48h) is inclusive', () => {
  // Interventions 3 calendar days before each check-in → outside the window.
  const threeDaysBefore = [
    intervention('Sauna', '2025-03-01'), checkIn('2025-03-04', { legs: 9 }),
    intervention('Sauna', '2025-03-08'), checkIn('2025-03-11', { legs: 9 }),
    intervention('Sauna', '2025-03-15'), checkIn('2025-03-18', { legs: 9 }),
    ...soloCheckIns('2025-04-10', 3, 5),
  ];
  const outside = buildTrainingResponseCorrelations(threeDaysBefore);
  assert.deepEqual(outside.correlations, [], 'a 3-day-old intervention must not tag a check-in');

  // Exactly 2 calendar days = exactly 48h with noon pinning → inclusive.
  const exactlyTwoDays = [
    intervention('Sauna', '2025-03-01'), checkIn('2025-03-03', { legs: 9 }),
    intervention('Sauna', '2025-03-08'), checkIn('2025-03-10', { legs: 9 }),
    intervention('Sauna', '2025-03-15'), checkIn('2025-03-17', { legs: 9 }),
    ...soloCheckIns('2025-04-10', 3, 5),
  ];
  const boundary = buildTrainingResponseCorrelations(exactlyTwoDays);
  assert.equal(boundary.correlations.length, 1);
  assert.equal(boundary.correlations[0].withCount, 3);
});

test('48h window is timezone/DST stable (US DST end falls inside the window)', () => {
  // DST in the US ended 2025-11-02. Local-noon parsing made 11-01 → 11-03
  // a 49h gap in America/Denver (excluded) but 48h in UTC (included).
  const data = [
    intervention('Sauna', '2025-11-01'), checkIn('2025-11-03', { legs: 9 }),
    intervention('Sauna', '2025-11-08'), checkIn('2025-11-10', { legs: 9 }),
    intervention('Sauna', '2025-11-15'), checkIn('2025-11-17', { legs: 9 }),
    ...soloCheckIns('2025-12-01', 3, 5),
  ];
  const result = buildTrainingResponseCorrelations(data);
  assert.equal(result.correlations.length, 1);
  assert.equal(result.correlations[0].withCount, 3);
});

test('zero and missing scores are excluded before the second count gate', () => {
  const data = [
    checkIn('2025-03-01', { legs: 8 }),
    checkIn('2025-03-05', { legs: 7 }),
    checkIn('2025-03-09', { legs: 6 }),
    { intervention_type: 'Workout Check-in', date: '2025-03-13', protocol_payload: { legs_feel: '0', energy_feel: '0' } },
    { intervention_type: 'Workout Check-in', date: '2025-03-17', protocol_payload: null },
  ];
  const result = buildTrainingResponseCorrelations(data);
  // 5 check-ins pass the first gate, but only 3 scored → needsMore based on tagged count.
  assert.deepEqual(result.correlations, []);
  assert.equal(result.checkInCount, 3);
  assert.equal(result.needsMore, 1);
});

test('confidence tiers: 6/6 high, 4/4 moderate, 3/3 low', () => {
  const high = buildTrainingResponseCorrelations([
    ...pairedSeries('Sauna', '2025-01-01', 6, 9),
    ...soloCheckIns('2025-03-01', 6, 5),
  ]);
  assert.equal(high.correlations[0].confidence, 'high');

  const moderate = buildTrainingResponseCorrelations([
    ...pairedSeries('Sauna', '2025-01-01', 4, 9),
    ...soloCheckIns('2025-03-01', 4, 5),
  ]);
  assert.equal(moderate.correlations[0].confidence, 'moderate');

  const low = buildTrainingResponseCorrelations([
    ...pairedSeries('Sauna', '2025-01-01', 3, 9),
    ...soloCheckIns('2025-03-01', 3, 5),
  ]);
  assert.equal(low.correlations[0].confidence, 'low');
});

test('sort order: positive cards first, then by |delta| descending', () => {
  const data = [
    ...pairedSeries('Sauna', '2025-01-01', 4, 9),      // strongest positive
    ...pairedSeries('Massage', '2025-03-01', 4, 8),    // weaker positive
    ...pairedSeries('Cold Plunge', '2025-05-01', 4, 3), // negative
    ...soloCheckIns('2025-07-01', 4, 5),
  ];
  const { correlations } = buildTrainingResponseCorrelations(data);
  assert.equal(correlations.length, 3);
  assert.deepEqual(
    correlations.map((c) => c.interventionType),
    ['Sauna', 'Massage', 'Cold Plunge']
  );
  assert.equal(correlations[0].positive, true);
  assert.equal(correlations[1].positive, true);
  assert.equal(correlations[2].positive, false);
  assert.ok(correlations[0].deltaAbs >= correlations[1].deltaAbs);
});

test('malformed input never throws and is sensibly excluded', () => {
  const data = [
    { intervention_type: 'Workout Check-in', date: null, protocol_payload: { legs_feel: '8' } },
    { intervention_type: 'Workout Check-in', date: '2025-03-01', protocol_payload: { legs_feel: 'abc' } },
    { intervention_type: 'Sauna', date: null },
    ...pairedSeries('Sauna', '2025-04-01', 4, 9),
    ...soloCheckIns('2025-06-01', 4, 5),
  ];
  let result;
  assert.doesNotThrow(() => { result = buildTrainingResponseCorrelations(data); });
  // The unscoreable/undated check-ins do not join either group.
  assert.equal(result.correlations.length, 1);
  assert.equal(result.correlations[0].withCount, 4);
  assert.equal(result.correlations[0].withoutCount, 4);
});

// ─── buildCheckInTimeSeries ──────────────────────────────────────────────────

test('time series sorts ascending by date and respects limit', () => {
  const data = [
    checkIn('2025-03-09', { legs: 6 }),
    checkIn('2025-03-01', { legs: 8 }),
    checkIn('2025-03-05', { legs: 7 }),
    intervention('Sauna', '2025-03-02'),
  ];
  const series = buildCheckInTimeSeries(data);
  assert.deepEqual(series.map((p) => p.date), ['2025-03-01', '2025-03-05', '2025-03-09']);
  assert.equal(series[0].legsScore, 8);

  const limited = buildCheckInTimeSeries(data, 2);
  assert.deepEqual(limited.map((p) => p.date), ['2025-03-05', '2025-03-09']);
});

test('time series turns zero/missing scores into null', () => {
  const data = [
    { intervention_type: 'Workout Check-in', date: '2025-03-01', protocol_payload: { legs_feel: '0', energy_feel: '' } },
  ];
  const [point] = buildCheckInTimeSeries(data);
  assert.equal(point.legsScore, null);
  assert.equal(point.energyScore, null);
  assert.equal(point.effort, null);
});

// ─── buildCheckInSummary ─────────────────────────────────────────────────────

test('summary returns null for no check-ins', () => {
  assert.equal(buildCheckInSummary([]), null);
  assert.equal(buildCheckInSummary([intervention('Sauna', '2025-03-01')]), null);
});

test('summary averages round to one decimal', () => {
  const data = [
    checkIn('2025-03-01', { legs: 7, energy: 6 }),
    checkIn('2025-03-02', { legs: 8, energy: 7 }),
    checkIn('2025-03-03', { legs: 7, energy: 7 }),
  ];
  const summary = buildCheckInSummary(data);
  assert.equal(summary.count, 3);
  assert.equal(summary.avgLegs, 7.3); // 22/3 = 7.333…
  assert.equal(summary.avgEnergy, 6.7); // 20/3 = 6.666…
});

test('summary computes 7-day vs prior-7-day legs trend', () => {
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const data = [
    // Recent window (last 7 days): avg 8
    checkIn(daysAgo(1), { legs: 8 }),
    checkIn(daysAgo(3), { legs: 8 }),
    // Prior window (7–14 days ago): avg 6
    checkIn(daysAgo(9), { legs: 6 }),
    checkIn(daysAgo(11), { legs: 6 }),
  ];
  const summary = buildCheckInSummary(data);
  assert.equal(summary.recentAvgLegs, 8);
  assert.equal(summary.priorAvgLegs, 6);
  assert.equal(summary.legsTrend, 2);
  assert.equal(summary.recentCount, 2);
});
