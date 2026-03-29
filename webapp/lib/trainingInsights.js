/**
 * trainingInsights.js
 *
 * Correlation engine: finds patterns between interventions (recovery, prep, nutrition)
 * and subsequent workout quality as measured by "Workout Check-in" logs.
 *
 * Core question answered: "When you do X, does your next training session feel better?"
 *
 * Method:
 *  1. Identify all Workout Check-in entries with legs_feel or energy_feel data.
 *  2. For each check-in, find all non-check-in interventions logged 0–48hrs prior.
 *  3. Tag each check-in with which intervention types were "active" in that window.
 *  4. For each intervention type, split check-ins into WITH and WITHOUT groups.
 *  5. Compare average legs_feel and energy_feel between groups.
 *  6. Report the delta as an insight card if the signal is meaningful (≥ 3 per group, |delta| ≥ 0.4).
 */

const CHECKIN_TYPE = 'Workout Check-in';
const WINDOW_HOURS = 48; // hours before check-in to look for active interventions
const MIN_GROUP_SIZE = 3; // minimum check-ins in each group to report a finding
const MIN_DELTA = 0.4;    // minimum score delta to surface (avoids noise)

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toTimestamp(dateStr) {
  if (!dateStr) return null;
  const ts = new Date(`${dateStr}T12:00:00`).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Describe what the correlation means in plain athlete language.
 */
function buildCorrelationNarrative(type, delta, metric, withCount, withoutCount, avgWith, avgWithout) {
  const direction = delta > 0 ? 'higher' : 'lower';
  const metricLabel = metric === 'legs' ? 'legs feel' : 'energy level';
  const absD = Math.abs(delta);
  const strength = absD >= 1.5 ? 'strong signal' : absD >= 0.8 ? 'clear pattern' : 'emerging pattern';
  const comparison = delta > 0
    ? `${avgWith}/10 on days following ${type} vs ${avgWithout}/10 without`
    : `${avgWith}/10 on days following ${type} vs ${avgWithout}/10 without`;

  return `${strength}: your ${metricLabel} scores ${direction} on training days that follow a ${type} session (${comparison}). Based on ${withCount} check-ins with and ${withoutCount} without.`;
}

/**
 * Tag each check-in with which intervention types were active in the prior window.
 */
function tagCheckInsWithActiveInterventions(checkIns, nonCheckIns) {
  return checkIns.map((ci) => {
    const ciTs = toTimestamp(ci.date);
    if (!ciTs) return { ...ci, activeTypes: new Set(), hasScore: false };

    const windowStart = ciTs - WINDOW_HOURS * 3600 * 1000;

    const activeTypes = new Set(
      nonCheckIns
        .filter((ni) => {
          const niTs = toTimestamp(ni.date);
          return niTs !== null && niTs >= windowStart && niTs <= ciTs;
        })
        .map((ni) => ni.intervention_type)
        .filter(Boolean)
    );

    const legsScore = parseFloat(ci.protocol_payload?.legs_feel || 0) || 0;
    const energyScore = parseFloat(ci.protocol_payload?.energy_feel || 0) || 0;
    const effortScore = parseFloat(ci.protocol_payload?.perceived_effort || 0) || 0;

    return {
      ...ci,
      activeTypes,
      legsScore,
      energyScore,
      effortScore,
      hasScore: legsScore > 0 || energyScore > 0,
    };
  });
}

// ─── Main export: build correlation insight cards ────────────────────────────

/**
 * @param {Array} interventions - all logged interventions for the athlete
 * @returns {Array} correlation cards sorted by delta strength
 */
export function buildTrainingResponseCorrelations(interventions = []) {
  const checkIns = interventions.filter((i) => i.intervention_type === CHECKIN_TYPE);
  const nonCheckIns = interventions.filter((i) => i.intervention_type !== CHECKIN_TYPE && i.date);

  if (checkIns.length < MIN_GROUP_SIZE + 1) {
    return { correlations: [], checkInCount: checkIns.length, needsMore: Math.max(0, MIN_GROUP_SIZE + 1 - checkIns.length) };
  }

  const tagged = tagCheckInsWithActiveInterventions(checkIns, nonCheckIns).filter((ci) => ci.hasScore);

  if (tagged.length < MIN_GROUP_SIZE + 1) {
    return { correlations: [], checkInCount: tagged.length, needsMore: Math.max(0, MIN_GROUP_SIZE + 1 - tagged.length) };
  }

  // All intervention types that appear in any check-in window
  const allTypes = [...new Set(tagged.flatMap((ci) => [...ci.activeTypes]))];

  const correlations = [];

  allTypes.forEach((type) => {
    const withType = tagged.filter((ci) => ci.activeTypes.has(type));
    const withoutType = tagged.filter((ci) => !ci.activeTypes.has(type));

    if (withType.length < MIN_GROUP_SIZE || withoutType.length < MIN_GROUP_SIZE) return;

    // Legs feel analysis
    const legsWithArr = withType.map((c) => c.legsScore).filter((s) => s > 0);
    const legsWithoutArr = withoutType.map((c) => c.legsScore).filter((s) => s > 0);
    const avgLegsWithType = mean(legsWithArr);
    const avgLegsWithoutType = mean(legsWithoutArr);
    const legsDelta = avgLegsWithType !== null && avgLegsWithoutType !== null
      ? round1(avgLegsWithType - avgLegsWithoutType)
      : null;

    // Energy feel analysis
    const energyWithArr = withType.map((c) => c.energyScore).filter((s) => s > 0);
    const energyWithoutArr = withoutType.map((c) => c.energyScore).filter((s) => s > 0);
    const avgEnergyWithType = mean(energyWithArr);
    const avgEnergyWithoutType = mean(energyWithoutArr);
    const energyDelta = avgEnergyWithType !== null && avgEnergyWithoutType !== null
      ? round1(avgEnergyWithType - avgEnergyWithoutType)
      : null;

    // Pick the stronger signal
    const primaryMetric = (legsDelta !== null && (energyDelta === null || Math.abs(legsDelta) >= Math.abs(energyDelta)))
      ? 'legs'
      : 'energy';

    const primaryDelta = primaryMetric === 'legs' ? legsDelta : energyDelta;
    const avgWith = primaryMetric === 'legs'
      ? (avgLegsWithType !== null ? round1(avgLegsWithType) : null)
      : (avgEnergyWithType !== null ? round1(avgEnergyWithType) : null);
    const avgWithout = primaryMetric === 'legs'
      ? (avgLegsWithoutType !== null ? round1(avgLegsWithoutType) : null)
      : (avgEnergyWithoutType !== null ? round1(avgEnergyWithoutType) : null);

    if (primaryDelta === null || Math.abs(primaryDelta) < MIN_DELTA) return;
    if (avgWith === null || avgWithout === null) return;

    correlations.push({
      id: `correlation-${type.replace(/\s+/g, '-').toLowerCase()}`,
      interventionType: type,
      metric: primaryMetric,
      delta: primaryDelta,
      deltaAbs: Math.abs(primaryDelta),
      positive: primaryDelta > 0,
      avgWith,
      avgWithout,
      withCount: withType.length,
      withoutCount: withoutType.length,
      // Also include both metrics if both have signal
      legsDelta,
      energyDelta,
      avgLegsWithType: avgLegsWithType !== null ? round1(avgLegsWithType) : null,
      avgLegsWithoutType: avgLegsWithoutType !== null ? round1(avgLegsWithoutType) : null,
      avgEnergyWithType: avgEnergyWithType !== null ? round1(avgEnergyWithType) : null,
      avgEnergyWithoutType: avgEnergyWithoutType !== null ? round1(avgEnergyWithoutType) : null,
      narrative: buildCorrelationNarrative(
        type, primaryDelta, primaryMetric, withType.length, withoutType.length, avgWith, avgWithout
      ),
      confidence: withType.length >= 6 && withoutType.length >= 6 ? 'high'
        : withType.length >= 4 && withoutType.length >= 4 ? 'moderate'
        : 'low',
      dataPoints: withType.length + withoutType.length,
    });
  });

  // Sort: strongest positive effect first, then strongest negative
  correlations.sort((a, b) => {
    if (a.positive !== b.positive) return a.positive ? -1 : 1;
    return b.deltaAbs - a.deltaAbs;
  });

  return { correlations, checkInCount: tagged.length, needsMore: 0 };
}

/**
 * Build a rolling time-series of check-in scores for trend charts.
 * Returns last N check-ins with date, legsScore, energyScore.
 */
export function buildCheckInTimeSeries(interventions = [], limit = 20) {
  return interventions
    .filter((i) => i.intervention_type === CHECKIN_TYPE && i.date)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(-limit)
    .map((ci) => ({
      date: ci.date,
      sessionType: ci.protocol_payload?.session_type || '',
      legsScore: parseFloat(ci.protocol_payload?.legs_feel || 0) || null,
      energyScore: parseFloat(ci.protocol_payload?.energy_feel || 0) || null,
      effort: parseFloat(ci.protocol_payload?.perceived_effort || 0) || null,
    }));
}

/**
 * Compute aggregate check-in stats: avg scores, best/worst, recent trend.
 */
export function buildCheckInSummary(interventions = []) {
  const checkIns = interventions
    .filter((i) => i.intervention_type === CHECKIN_TYPE && i.date)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (checkIns.length === 0) return null;

  const legsScores = checkIns.map((c) => parseFloat(c.protocol_payload?.legs_feel || 0)).filter((s) => s > 0);
  const energyScores = checkIns.map((c) => parseFloat(c.protocol_payload?.energy_feel || 0)).filter((s) => s > 0);

  const avgLegs = legsScores.length ? round1(mean(legsScores)) : null;
  const avgEnergy = energyScores.length ? round1(mean(energyScores)) : null;

  // 7-day rolling average vs prior 7-day (trend)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000);

  const recent = checkIns.filter((c) => new Date(`${c.date}T12:00:00`) >= sevenDaysAgo);
  const prior = checkIns.filter((c) => {
    const d = new Date(`${c.date}T12:00:00`);
    return d >= fourteenDaysAgo && d < sevenDaysAgo;
  });

  const recentLegsArr = recent.map((c) => parseFloat(c.protocol_payload?.legs_feel || 0)).filter((s) => s > 0);
  const priorLegsArr = prior.map((c) => parseFloat(c.protocol_payload?.legs_feel || 0)).filter((s) => s > 0);

  const recentMeanLegs = mean(recentLegsArr);
  const priorMeanLegs = mean(priorLegsArr);
  const recentAvgLegs = recentMeanLegs !== null ? round1(recentMeanLegs) : null;
  const priorAvgLegs = priorMeanLegs !== null ? round1(priorMeanLegs) : null;

  const legsTrend = recentAvgLegs !== null && priorAvgLegs !== null ? round1(recentAvgLegs - priorAvgLegs) : null;

  return {
    count: checkIns.length,
    avgLegs,
    avgEnergy,
    recentAvgLegs,
    priorAvgLegs,
    legsTrend,
    recentCount: recent.length,
  };
}
