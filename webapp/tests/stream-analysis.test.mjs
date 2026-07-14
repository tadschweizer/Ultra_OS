import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSteadyState, computeDecoupling, computeHrDrift, resamplePoints } from '../lib/streamAnalysis.js';

/**
 * Build index-aligned Strava-style streams from a generator: for each second
 * 0..durationSec, gen(t) returns { v (m/s), hr }. Distance accumulates.
 */
function syntheticStreams(durationSec, gen) {
  const time = [];
  const distance = [];
  const heartrate = [];
  const velocity = [];
  let d = 0;
  for (let t = 0; t <= durationSec; t += 1) {
    const { v, hr } = gen(t);
    d += v; // 1s samples
    time.push(t);
    distance.push(d);
    heartrate.push(hr);
    velocity.push(v);
  }
  return {
    time: { data: time },
    distance: { data: distance },
    heartrate: { data: heartrate },
    velocity_smooth: { data: velocity },
  };
}

const HOUR = 3600;

test('constant pace and HR: drift ≈ 0 and decoupling ≈ 0', () => {
  const streams = syntheticStreams(HOUR, () => ({ v: 3.2, hr: 140 }));
  const analysis = analyzeSteadyState(streams, {}, { sport: 'Run' });
  assert.ok(analysis, 'steady hour run must be analyzable');
  assert.ok(Math.abs(analysis.driftPct) < 0.5, `drift ${analysis.driftPct} should be ~0`);
  assert.ok(Math.abs(analysis.decouplingPct) < 0.5, `decoupling ${analysis.decouplingPct} should be ~0`);
});

test('constant pace with HR ramping 140→155 shows positive drift and decoupling', () => {
  const streams = syntheticStreams(HOUR, (t) => ({ v: 3.2, hr: 140 + (15 * t) / HOUR }));
  const analysis = analyzeSteadyState(streams, {}, { sport: 'Run' });
  assert.ok(analysis);
  // 20–35% window mean ≈ 144.1, 70–85% window mean ≈ 151.6 → ~5.2% drift.
  assert.ok(analysis.driftPct > 3 && analysis.driftPct < 8, `drift ${analysis.driftPct} should be positive`);
  assert.ok(analysis.decouplingPct > 2, `decoupling ${analysis.decouplingPct} should be positive`);
  assert.equal(analysis.similarPace, true);
});

test('interval-shaped pace is rejected by the steadiness gate', () => {
  const streams = syntheticStreams(HOUR, (t) => {
    const hard = Math.floor(t / 180) % 2 === 0; // 3-min on/off
    return { v: hard ? 5 : 2.2, hr: hard ? 168 : 138 };
  });
  assert.equal(analyzeSteadyState(streams, {}, { sport: 'Run' }), null);
});

test('a 20-minute activity is too short to score', () => {
  const streams = syntheticStreams(20 * 60, () => ({ v: 3.2, hr: 140 }));
  assert.equal(analyzeSteadyState(streams, {}, { sport: 'Run' }), null);
});

test('gaps and missing HR samples never produce NaN', () => {
  const streams = syntheticStreams(HOUR, (t) => ({ v: 3.2, hr: 142 }));
  // Punch holes in the HR stream and a stopped stretch into velocity.
  for (let i = 500; i < 700; i += 1) streams.heartrate.data[i] = null;
  for (let i = 1800; i < 1900; i += 1) streams.velocity_smooth.data[i] = 0;
  const analysis = analyzeSteadyState(streams, {}, { sport: 'Run' });
  assert.ok(analysis, 'gappy but steady run still scores');
  assert.ok(Number.isFinite(analysis.driftPct));
  assert.ok(Number.isFinite(analysis.decouplingPct));
});

test('non-run sports and missing streams return null, not a crash', () => {
  const streams = syntheticStreams(HOUR, () => ({ v: 8, hr: 140 }));
  assert.equal(analyzeSteadyState(streams, {}, { sport: 'Ride' }), null);
  assert.equal(analyzeSteadyState({}, {}, { sport: 'Run' }), null);
  assert.equal(analyzeSteadyState({ altitude: { data: [1, 2, 3] } }, {}, { sport: 'Run' }), null);
  assert.equal(analyzeSteadyState(null, {}, { sport: 'Run' }), null);
});

test('Z2 comparison appears only when settings provide a ceiling', () => {
  const streams = syntheticStreams(HOUR, (t) => ({ v: 3.2, hr: 150 + (6 * t) / HOUR }));
  const withZones = analyzeSteadyState(streams, { hr_zone_2_max: 148 }, { sport: 'Run' });
  assert.equal(withZones.z2Ceiling, 148);
  assert.equal(withZones.aboveZ2, true);

  const withoutZones = analyzeSteadyState(streams, {}, { sport: 'Run' });
  assert.equal(withoutZones.z2Ceiling, null);
  assert.equal(withoutZones.aboveZ2, null);
});

test('negative drift (downhill back half) is preserved, not clamped', () => {
  const streams = syntheticStreams(HOUR, (t) => ({ v: 3.2, hr: t < HOUR / 2 ? 150 : 145 }));
  const analysis = analyzeSteadyState(streams, {}, { sport: 'Run' });
  assert.ok(analysis);
  assert.ok(analysis.driftPct < 0, `drift ${analysis.driftPct} should stay negative`);
});

test('resamplePoints drops stopped samples and computes fallback velocity', () => {
  const streams = syntheticStreams(600, () => ({ v: 3, hr: 140 }));
  delete streams.velocity_smooth; // force distance/time fallback
  const points = resamplePoints(streams);
  assert.ok(points.length > 500);
  assert.ok(points.every((p) => p.v >= 0.5));
});

test('computeDecoupling and computeHrDrift return invalid on tiny inputs', () => {
  assert.equal(computeDecoupling([]).valid, false);
  assert.equal(computeHrDrift([]).valid, false);
  const few = [{ t: 0, d: 0, hr: 140, v: 3 }, { t: 1, d: 3, hr: 140, v: 3 }];
  assert.equal(computeDecoupling(few).valid, false);
  assert.equal(computeHrDrift(few).valid, false);
});
