import { deriveRaceType } from './raceTypes';

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date;
}

export function generateCoachCode(displayName = 'COACH') {
  const base = displayName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'COACH';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export function normalizeRace(race = {}) {
  return {
    ...race,
    race_type: race.race_type || deriveRaceType(race.distance_miles, race.surface),
  };
}

export function countAssignmentCompletions(assignment, interventions = []) {
  if (!assignment) return 0;

  return interventions.filter((item) => {
    if (item.intervention_type !== assignment.intervention_type) return false;

    const interventionDate = item.date || item.inserted_at?.slice(0, 10);
    if (!interventionDate) return false;

    if (interventionDate < assignment.start_date || interventionDate > assignment.target_completion_date) {
      return false;
    }

    if (!assignment.target_race_id) return true;

    return item.race_id === assignment.target_race_id || item.races?.id === assignment.target_race_id;
  }).length;
}

export function computePhaseFromDays(daysUntil) {
  if (daysUntil === null || daysUntil === undefined) return 'Base';
  if (daysUntil > 84) return 'Base';
  if (daysUntil >= 56) return 'Build';
  if (daysUntil >= 21) return 'Peak';
  if (daysUntil >= 7) return 'Taper';
  return 'Race Week';
}

export function getDaysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function computePlannedSessions({
  startDate,
  endDate,
  frequencyType,
  plannedSessions,
}) {
  if (plannedSessions !== null && plannedSessions !== undefined && plannedSessions !== '') {
    return Number(plannedSessions);
  }

  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  if (frequencyType === 'daily') return diffDays;
  if (frequencyType === 'every_other_day') return Math.ceil(diffDays / 2);
  if (frequencyType === 'weekly') return Math.ceil(diffDays / 7);
  return 0;
}

export function buildAssignmentStatusLabel(assignment, completionCount) {
  if (!assignment) return 'No active protocols — log your first intervention';
  const label =
    assignment.intervention_type === 'Heat Acclimation'
      ? 'Heat block'
      : assignment.intervention_type === 'Gut Training'
        ? 'Gut block'
        : `${assignment.intervention_type}`;
  return `${label}: ${completionCount} session${completionCount === 1 ? '' : 's'} logged / ${assignment.planned_sessions} planned`;
}

export function inferRaceFromAssignments(assignments = [], races = []) {
  const active = assignments.find((item) => item.status === 'active');
  if (!active?.target_race_id) return null;
  return normalizeRace(races.find((race) => race.id === active.target_race_id) || null);
}

export function defaultAssignmentWindow(startDate) {
  if (!startDate) return null;
  return addDays(startDate, 41).toISOString().slice(0, 10);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeContraindications(guardrails = []) {
  return guardrails.filter((item) => item.triggered).map((item) => item.reason);
}

export function evaluateProtocolRules({
  interventionType,
  frequencyType = 'weekly',
  plannedSessions,
  responseMetrics = {},
  currentLoad = {},
  coachOverrideReason = null,
}) {
  const metrics = {
    adherenceRate: toNumber(responseMetrics.adherence_rate),
    avgRpe: toNumber(responseMetrics.avg_rpe),
    recoveryScore: toNumber(responseMetrics.recovery_score),
    symptomScore: toNumber(responseMetrics.symptom_score),
    sleepDebtHours: toNumber(responseMetrics.sleep_debt_hours),
    readinessScore: toNumber(responseMetrics.readiness_score),
  };

  const load = {
    weeklyLoad: toNumber(currentLoad.weekly_load),
    acuteChronicRatio: toNumber(currentLoad.acute_chronic_ratio),
  };

  const guardrails = [
    {
      key: 'sleep_debt_high_load',
      triggered: (metrics.sleepDebtHours ?? 0) >= 4 && (load.acuteChronicRatio ?? 0) >= 1.2,
      reason: 'Sleep debt is elevated while acute load is high.',
      action: 'reduce',
    },
    {
      key: 'high_rpe_low_recovery',
      triggered: (metrics.avgRpe ?? 0) >= 8 && (metrics.recoveryScore ?? 100) <= 55,
      reason: 'Perceived effort is high with poor recovery trend.',
      action: 'reduce',
    },
  ];

  const contraindications = summarizeContraindications(guardrails);
  let decision = 'maintain';
  let confidence = 'moderate';
  const reasons = [];
  let frequencyRecommendation = frequencyType;
  let plannedSessionsRecommendation = plannedSessions ?? null;

  if (metrics.adherenceRate !== null && metrics.adherenceRate >= 0.85 && (metrics.recoveryScore ?? 0) >= 70) {
    decision = 'progress';
    confidence = 'high';
    reasons.push('High adherence with stable recovery supports progression.');
    if (frequencyType === 'weekly') frequencyRecommendation = 'every_other_day';
    if (plannedSessionsRecommendation !== null && plannedSessionsRecommendation !== undefined) {
      plannedSessionsRecommendation = Math.max(1, Number(plannedSessionsRecommendation) + 1);
    }
  }

  if (metrics.symptomScore !== null && metrics.symptomScore >= 6) {
    decision = 'reduce';
    confidence = 'high';
    reasons.push('Symptoms increased and indicate reduced tolerance.');
  }

  if (contraindications.length) {
    decision = 'reduce';
    confidence = 'high';
    reasons.push(...contraindications);
    if (frequencyType === 'every_other_day' || frequencyType === 'daily') frequencyRecommendation = 'weekly';
    if (plannedSessionsRecommendation !== null && plannedSessionsRecommendation !== undefined) {
      plannedSessionsRecommendation = Math.max(1, Number(plannedSessionsRecommendation) - 1);
    }
  }

  if (!reasons.length) {
    reasons.push('Insufficient signal for progression or reduction; maintain current plan.');
    if ((metrics.readinessScore ?? 0) < 40) confidence = 'low';
  }

  const overrideApplied = Boolean(coachOverrideReason && coachOverrideReason.trim());
  const recommendationText = `${interventionType || 'Protocol'}: ${decision.toUpperCase()} — ${reasons.join(' ')}`;

  return {
    decision,
    confidence,
    reasons,
    contraindications,
    recommendationText,
    recommendation: {
      frequency_type: frequencyRecommendation,
      planned_sessions: plannedSessionsRecommendation,
    },
    override: {
      applied: overrideApplied,
      reason: overrideApplied ? coachOverrideReason.trim() : null,
    },
    generated_at: new Date().toISOString(),
  };
}
