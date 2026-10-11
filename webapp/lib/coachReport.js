import { checkInReadinessScore } from './checkIn.js';
import { countAssignmentCompletions } from './coachProtocols.js';
import { toDateKey } from './workoutCompliance.js';

export function reportWindow(now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - 27 * 86400000).toISOString().slice(0, 10);
  return { start, end, days: 28, timeZone: 'UTC', sampleLimit: 8 };
}

// Reconciliation keeps the calendar's existing local-day matching, separately
// from readiness's UTC timestamp samples. Subtract calendar days, not elapsed
// hours, so the bounds also remain stable across daylight-saving transitions.
export function reconciliationWindow(now = new Date()) {
  const end = toDateKey(now);
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - 27 * 86400000).toISOString().slice(0, 10);
  return { start, end, days: 28, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

// A UTC date can be one day ahead of the coach's local date; an athlete's
// stored local day can start on the preceding UTC day (e.g. UTC+14), even when
// the coach is west of UTC. Fetch two extra UTC days for reconciliation only.
// The client applies the explicit local
// bounds; readiness samples retain their existing UTC window and limits.
export function reconciliationFetchStart(window) {
  return new Date(Date.parse(`${window.start}T00:00:00Z`) - 2 * 86400000).toISOString().slice(0, 10);
}

export function usableReadinessScore(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}

export function buildCoachReport({ upcomingRace, activeProtocols, activities, checkins, interventions, fastCheckins, window }) {
  // These records are a bounded sample with no assignment-completion link.
  // planned_sessions is a count in the schema, not a percentage target.
  const compliance = activeProtocols.map(p => ({
    id: p.id, protocol_name: p.protocol_name || p.intervention_type,
    target: null, actual: null,
    plannedSessions: Number.isInteger(p.planned_sessions) && p.planned_sessions >= 0 ? p.planned_sessions : null,
    matchingSampleLogs: countAssignmentCompletions(p, interventions),
    startDate: p.start_date, endDate: p.target_completion_date,
  }));
  const scores = [
    ...checkins.map(c => ({ score: usableReadinessScore(c.readiness_score), date: c.created_at, source: 'daily check-in' })),
    ...fastCheckins.map(c => ({ score: checkInReadinessScore(c.protocol_payload), date: `${c.date}T00:00:00Z`, source: 'workout check-in' })),
  ].filter(c => c.score !== null && Number.isFinite(Date.parse(c.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const latest = scores[0];
  const riskLevel = !latest ? 'unknown' : latest.score < 45 ? 'red' : latest.score < 70 ? 'yellow' : 'green';
  const signals = [];
  if (activities[0]) signals.push(`Latest workout: ${activities[0].name || activities[0].activity_type || 'Activity'} on ${String(activities[0].start_date).slice(0, 10)} (UTC).`);
  if (latest) signals.push(`Latest usable check-in readiness score: ${latest.score} (${String(latest.date).slice(0, 10)}, ${latest.source}).`);
  if (scores.length >= 3) signals.push(`3 usable check-in readiness average: ${Math.round(scores.slice(0, 3).reduce((sum, c) => sum + c.score, 0) / 3)} (daily/workout check-ins in this window).`);
  const inputGroups = [
    ['Upcoming race date', Boolean(upcomingRace)],
    ['Active protocol assignment', activeProtocols.length > 0],
    ['Recent usable readiness scores', scores.length > 0],
    ['Recent workouts', activities.length > 0],
    ['Recent intervention logs', interventions.length > 0],
  ];
  const missingData = inputGroups.filter(([, present]) => !present).map(([label]) => label);
  if (activeProtocols.length) missingData.push('Protocol-linked completion records for compliance');
  const daysUntilRace = upcomingRace?.event_date ? Math.ceil((Date.parse(upcomingRace.event_date) - Date.parse(window.end)) / 86400000) : null;
  const raceReadiness = {
    window, daysUntilRace, daysUntilRaceLabel: daysUntilRace === null ? null : `${daysUntilRace} days`,
    protocolSummary: activeProtocols.map(p => p.protocol_name || p.intervention_type).slice(0, 3).join(', ') || null,
    complianceSummary: 'Compliance unavailable: protocol-linked completion records are required.',
    domains: [{ name: 'Heat', key: 'heat' }, { name: 'Gut', key: 'gut' }, { name: 'Fueling', key: 'fuel' }, { name: 'Sleep', key: 'sleep' }, { name: 'Recovery', key: 'recovery' }].map(d => {
      const count = interventions.filter(i => String(i.intervention_type || '').toLowerCase().includes(d.key)).length;
      return { name: d.name, status: count ? 'Logs recorded' : 'No logs in sample', note: `${count} log${count === 1 ? '' : 's'} in the latest ${window.sampleLimit}-log sample within this window.` };
    }),
    signals, missingData, confidence: 'unavailable',
    dataCoverage: { available: inputGroups.filter(([, present]) => present).length, total: inputGroups.length },
    suggestedAction: missingData.length ? `Collect missing inputs first: ${missingData.slice(0, 2).join(', ')}.` : 'Review the recorded inputs and assigned plan with the athlete.',
  };
  return { compliance, riskLevel, raceReadiness };
}
