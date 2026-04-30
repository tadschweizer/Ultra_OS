const DAY_MS = 86400000;

const COMMENT_RISK_KEYWORDS = [
  'injury',
  'hurt',
  'pain',
  'sick',
  'ill',
  'exhausted',
  'burnout',
  'overtrained',
  'cramp',
  'dizzy',
  'nausea',
  'dehydrated',
];

function daysSince(dateLike) {
  if (!dateLike) return null;
  const value = new Date(dateLike).getTime();
  if (Number.isNaN(value)) return null;
  return Math.floor((Date.now() - value) / DAY_MS);
}

function parseNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function getInterventionLoadScore(intervention) {
  const payload = intervention?.protocol_payload || {};
  const explicit =
    parseNumeric(payload.duration_min) ??
    parseNumeric(payload.duration_minutes) ??
    parseNumeric(intervention?.dose_duration) ??
    parseNumeric(payload.rpe);
  return explicit ?? 0;
}

export function evaluateAthleteTriage({ interventions = [], notes = [] } = {}) {
  const evidence = [];
  const actionable = [];
  const nowIso = new Date().toISOString().slice(0, 10);
  const recent = interventions
    .filter((item) => (item?.date || item?.inserted_at || nowIso) <= nowIso)
    .sort((a, b) => new Date(b.date || b.inserted_at).getTime() - new Date(a.date || a.inserted_at).getTime());

  const lastLog = recent[0] || null;
  const lastLogDate = lastLog?.date || lastLog?.inserted_at?.slice(0, 10) || null;
  const inactivityDays = daysSince(lastLogDate);
  if (inactivityDays === null || inactivityDays >= 7) {
    evidence.push(`No intervention logged for ${inactivityDays ?? '7+'} days.`);
    actionable.push('Check in today and log at least one recovery/training entry.');
  }

  const recent7 = recent.slice(0, 7);
  if (recent7.length >= 2) {
    const loads = recent7.map(getInterventionLoadScore);
    const avgBeforeLatest = loads.slice(1).reduce((sum, value) => sum + value, 0) / Math.max(loads.length - 1, 1);
    const latest = loads[0];
    if (latest >= avgBeforeLatest * 1.6 && latest >= 20) {
      evidence.push('Recent load spiked well above the prior week baseline.');
      actionable.push('Schedule a lower-load day and confirm sleep/hydration targets.');
    }

    const mean = loads.reduce((sum, value) => sum + value, 0) / loads.length;
    const variance = loads.reduce((sum, value) => sum + (value - mean) ** 2, 0) / loads.length;
    const stdDev = Math.sqrt(variance);
    const monotony = mean > 0 ? mean / Math.max(stdDev, 0.01) : 0;
    if (monotony >= 2.2 && mean >= 15) {
      evidence.push('Training monotony is high (similar load repeated with little variation).');
      actionable.push('Add variation: alternate easy/moderate days instead of repeating the same dose.');
    }
  }

  const latestText = `${lastLog?.notes || ''} ${lastLog?.details || ''} ${(notes || [])
    .slice(0, 5)
    .map((n) => n?.content || '')
    .join(' ')}`.toLowerCase();

  const matchedKeywords = COMMENT_RISK_KEYWORDS.filter((keyword) => latestText.includes(keyword));
  if (matchedKeywords.length) {
    evidence.push(`Risk terms found in comments/notes: ${matchedKeywords.slice(0, 3).join(', ')}.`);
    actionable.push('Open athlete notes and follow up on symptoms before increasing load.');
  }

  let alertLevel = 'green';
  if (evidence.length >= 2) alertLevel = 'red';
  else if (evidence.length === 1) alertLevel = 'yellow';

  return {
    alertLevel,
    reasons: evidence,
    suggestion: actionable[0] || 'Maintain current plan and keep logging.',
    lastLogDate,
    daysSinceLog: inactivityDays,
  };
}
