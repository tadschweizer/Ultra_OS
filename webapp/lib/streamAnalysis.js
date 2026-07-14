/**
 * Per-activity steady-state analysis from Strava streams: cardiac drift and
 * aerobic decoupling (Pa:HR). Pure functions, no I/O.
 *
 * Strava streams are index-aligned but NOT time-uniform, so all splitting is
 * by cumulative distance and all speeds are distance/time over a window —
 * never an unweighted mean of velocity samples. EF uses speed (m/s) / HR;
 * the <5% / >7% decoupling thresholds assume speed-based EF (pace-based EF
 * inverts the sign).
 */

import { resolveHrThresholds } from './activityInsights.js';

const MIN_DURATION_SEC = 40 * 60;
const MIN_WINDOW_SAMPLES = 30;
// Standing at a light with a high HR poisons window means — drop stopped samples.
const MIN_MOVING_SPEED_MS = 0.5;
// Interval/fartlek sessions must not be scored as steady-state.
const MAX_STEADY_SPEED_CV = 0.25;
const MAX_WINDOW_PACE_DIFF_PCT = 10;
// "At similar pace" claim allowed only when window paces are within 5%.
const SIMILAR_PACE_PCT = 5;

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Merge aligned streams into moving samples of { t, d, hr, v }, skipping
 * indices with missing hr/time/distance and samples below moving speed.
 */
export function resamplePoints(streams = {}) {
  const time = streams?.time?.data;
  const distance = streams?.distance?.data;
  const heartrate = streams?.heartrate?.data;
  const velocity = streams?.velocity_smooth?.data;
  if (!Array.isArray(time) || !Array.isArray(distance) || !Array.isArray(heartrate)) return [];

  const length = Math.min(time.length, distance.length, heartrate.length);
  const points = [];
  let prev = null;
  for (let i = 0; i < length; i += 1) {
    const t = Number(time[i]);
    const d = Number(distance[i]);
    const hr = Number(heartrate[i]);
    if (!Number.isFinite(t) || !Number.isFinite(d) || !Number.isFinite(hr) || hr <= 0) continue;

    let v = Array.isArray(velocity) ? Number(velocity[i]) : NaN;
    if (!Number.isFinite(v)) {
      v = prev && t > prev.t ? (d - prev.d) / (t - prev.t) : 0;
    }
    prev = { t, d };
    if (v < MIN_MOVING_SPEED_MS) continue;
    points.push({ t, d, hr, v });
  }
  return points;
}

/** Samples within a [startFrac, endFrac) slice of total covered distance. */
function windowByDistance(points, startFrac, endFrac) {
  const d0 = points[0].d;
  const total = points[points.length - 1].d - d0;
  return points.filter((p) => {
    const frac = (p.d - d0) / total;
    return frac >= startFrac && frac < endFrac;
  });
}

/** Distance-over-time speed and simple HR mean for a window of samples. */
function windowStats(window) {
  if (!window || window.length < MIN_WINDOW_SAMPLES) return null;
  const elapsed = window[window.length - 1].t - window[0].t;
  const covered = window[window.length - 1].d - window[0].d;
  if (elapsed <= 0 || covered <= 0) return null;
  const meanHr = window.reduce((sum, p) => sum + p.hr, 0) / window.length;
  if (meanHr <= 0) return null;
  return { speed: covered / elapsed, meanHr, samples: window.length };
}

/**
 * Aerobic decoupling: EF (speed/HR) of the first distance half vs the second.
 * Positive % means efficiency faded.
 */
export function computeDecoupling(points) {
  const invalid = { decouplingPct: null, ef1: null, ef2: null, valid: false };
  if (!Array.isArray(points) || points.length < MIN_WINDOW_SAMPLES * 2) return invalid;

  const first = windowStats(windowByDistance(points, 0, 0.5));
  const second = windowStats(windowByDistance(points, 0.5, 1.000001));
  if (!first || !second) return invalid;

  const ef1 = first.speed / first.meanHr;
  const ef2 = second.speed / second.meanHr;
  return {
    decouplingPct: round1(((ef1 - ef2) / ef1) * 100),
    ef1: Math.round(ef1 * 10000) / 10000,
    ef2: Math.round(ef2 * 10000) / 10000,
    valid: true,
  };
}

/**
 * Cardiac drift: mean HR in the 20–35% distance window vs the 70–85% window
 * (skips warmup and finish surge). Also reports window paces so callers only
 * claim "at similar pace" when it's true.
 */
export function computeHrDrift(points) {
  const invalid = { driftPct: null, hr1: null, hr2: null, speed1: null, speed2: null, similarPace: false, valid: false };
  if (!Array.isArray(points) || points.length < MIN_WINDOW_SAMPLES * 2) return invalid;

  const early = windowStats(windowByDistance(points, 0.2, 0.35));
  const late = windowStats(windowByDistance(points, 0.7, 0.85));
  if (!early || !late) return invalid;

  const paceDiffPct = Math.abs(late.speed - early.speed) / early.speed * 100;
  return {
    driftPct: round1(((late.meanHr - early.meanHr) / early.meanHr) * 100),
    hr1: Math.round(early.meanHr),
    hr2: Math.round(late.meanHr),
    speed1: Math.round(early.speed * 100) / 100,
    speed2: Math.round(late.speed * 100) / 100,
    paceDiffPct: round1(paceDiffPct),
    similarPace: paceDiffPct <= SIMILAR_PACE_PCT,
    valid: true,
  };
}

function speedCoefficientOfVariation(points) {
  const mean = points.reduce((sum, p) => sum + p.v, 0) / points.length;
  if (mean <= 0) return Infinity;
  const variance = points.reduce((sum, p) => sum + (p.v - mean) ** 2, 0) / points.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Full suitability-gated analysis. Returns null for anything that is not a
 * steady run ≥40 min with usable HR/distance streams — intervals, short
 * sessions, treadmill/manual activities, and rides must not be scored.
 */
export function analyzeSteadyState(streams, settings = {}, { sport = 'Run' } = {}) {
  if (!/run/i.test(String(sport || ''))) return null;

  const points = resamplePoints(streams);
  if (points.length < MIN_WINDOW_SAMPLES * 2) return null;

  const durationSec = points[points.length - 1].t - points[0].t;
  if (durationSec < MIN_DURATION_SEC) return null;

  // Steadiness gates: overall speed variability and drift-window pace drift.
  if (speedCoefficientOfVariation(points) > MAX_STEADY_SPEED_CV) return null;

  const drift = computeHrDrift(points);
  const decoupling = computeDecoupling(points);
  if (!drift.valid || !decoupling.valid) return null;
  if (drift.paceDiffPct > MAX_WINDOW_PACE_DIFF_PCT) return null;

  const z2Ceiling = resolveHrThresholds(settings).zone2Max;

  return {
    durationMin: Math.round(durationSec / 60),
    decouplingPct: decoupling.decouplingPct,
    ef1: decoupling.ef1,
    ef2: decoupling.ef2,
    driftPct: drift.driftPct,
    hr1: drift.hr1,
    hr2: drift.hr2,
    similarPace: drift.similarPace,
    z2Ceiling: z2Ceiling || null,
    aboveZ2: z2Ceiling ? drift.hr2 > z2Ceiling : null,
  };
}
