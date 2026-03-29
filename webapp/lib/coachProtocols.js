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
