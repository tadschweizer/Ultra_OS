import { getInterventionDefinition } from './interventionCatalog';

export const protocolStatusOptions = ['assigned', 'in_progress', 'completed', 'abandoned'];
export const protocolSourceOptions = ['template', 'custom'];
export const defaultComplianceTarget = 80;

export function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDateOnly(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return String(value);
  }
  const parsed = safeDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

export function createEmptyWeeklyBlock(weekNumber = 1) {
  return {
    week_number: weekNumber,
    instruction_text: '',
    frequency_per_week: '',
    target_metric: '',
  };
}

export function createTemplateDraft(overrides = {}) {
  const durationWeeks = Number(overrides.duration_weeks || 4);
  return {
    name: overrides.name || '',
    protocol_type: overrides.protocol_type || '',
    description: overrides.description || '',
    duration_weeks: durationWeeks,
    instructions: buildInstructionsPayload(
      normalizeWeeklyBlocks(overrides.instructions?.weekly_blocks, durationWeeks)
    ),
    is_shared: overrides.is_shared === true,
  };
}

export function normalizeWeeklyBlocks(blocks, durationWeeks = 0) {
  const source = Array.isArray(blocks) ? blocks : [];
  const normalized = source
    .map((block, index) => ({
      week_number: Number(block?.week_number || index + 1),
      instruction_text: String(block?.instruction_text || '').trim(),
      frequency_per_week:
        block?.frequency_per_week === '' || block?.frequency_per_week === null || block?.frequency_per_week === undefined
          ? ''
          : Number(block.frequency_per_week),
      target_metric: String(block?.target_metric || '').trim(),
    }))
    .sort((left, right) => left.week_number - right.week_number);

  if (normalized.length) {
    const reindexed = normalized.map((block, index) => ({
      ...block,
      week_number: index + 1,
    }));

    if (!durationWeeks) {
      return reindexed;
    }

    return Array.from({ length: Math.max(1, Number(durationWeeks)) }, (_, index) => (
      reindexed[index] || createEmptyWeeklyBlock(index + 1)
    ));
  }

  const count = Math.max(1, Number(durationWeeks || 1));
  return Array.from({ length: count }, (_, index) => createEmptyWeeklyBlock(index + 1));
}

export function buildInstructionsPayload(weeklyBlocks = []) {
  return {
    weekly_blocks: normalizeWeeklyBlocks(weeklyBlocks),
  };
}

export function extractWeeklyBlocks(instructions, durationWeeks = 0) {
  if (instructions?.weekly_blocks && Array.isArray(instructions.weekly_blocks)) {
    return normalizeWeeklyBlocks(instructions.weekly_blocks, durationWeeks);
  }

  if (Array.isArray(instructions)) {
    return normalizeWeeklyBlocks(
      instructions.map((item, index) => ({
        week_number: index + 1,
        instruction_text: String(item || ''),
        frequency_per_week: '',
        target_metric: '',
      })),
      durationWeeks
    );
  }

  if (typeof instructions === 'string') {
    return normalizeWeeklyBlocks(
      instructions
        .split(/\r?\n/)
        .map((item, index) => ({
          week_number: index + 1,
          instruction_text: item,
          frequency_per_week: '',
          target_metric: '',
        })),
      durationWeeks
    );
  }

  return normalizeWeeklyBlocks([], durationWeeks);
}

export function calculateDurationWeeks(startDate, endDate) {
  const start = safeDate(startDate);
  const end = safeDate(endDate);
  if (!start || !end || end < start) return 0;
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, Math.ceil(diffDays / 7));
}

export function getElapsedProtocolWeeks(protocol, now = new Date()) {
  const start = safeDate(protocol?.start_date);
  if (!start) return 0;

  const today = safeDate(now) || new Date();
  today.setHours(0, 0, 0, 0);

  const end = safeDate(protocol?.end_date) || today;
  end.setHours(0, 0, 0, 0);

  if (today < start) return 0;

  const effectiveEnd = end < today ? end : today;
  if (effectiveEnd < start) return 0;

  const elapsedDays = Math.floor((effectiveEnd.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, Math.ceil(elapsedDays / 7));
}

export function getCurrentProtocolWeek(protocol, now = new Date()) {
  const totalWeeks = calculateDurationWeeks(protocol?.start_date, protocol?.end_date);
  if (!totalWeeks) return 0;
  const elapsedWeeks = getElapsedProtocolWeeks(protocol, now);
  if (!elapsedWeeks) return 1;
  return Math.min(totalWeeks, elapsedWeeks);
}

export function getExpectedEntriesForProtocol(protocol, now = new Date()) {
  const weeksElapsed = getElapsedProtocolWeeks(protocol, now);
  if (!weeksElapsed) return 0;

  const blocks = extractWeeklyBlocks(protocol?.instructions, protocol?.duration_weeks || calculateDurationWeeks(protocol?.start_date, protocol?.end_date));
  if (!blocks.length) {
    return weeksElapsed;
  }

  const expectedFromBlocks = blocks
    .filter((block) => block.week_number <= weeksElapsed)
    .reduce((total, block) => total + (Number(block.frequency_per_week) || 0), 0);

  return expectedFromBlocks || weeksElapsed;
}

export function protocolMatchesIntervention(protocol, entry, options = {}) {
  const { respectAssignedProtocolId = true } = options;
  if (!protocol || !entry) return false;

  if (respectAssignedProtocolId && entry.assigned_protocol_id) {
    return entry.assigned_protocol_id === protocol.id;
  }

  if (entry.intervention_type !== protocol.protocol_type) return false;

  const interventionDate = toDateOnly(entry.date || entry.inserted_at);
  const startDate = toDateOnly(protocol.start_date);
  const endDate = toDateOnly(protocol.end_date);

  if (!interventionDate || !startDate || !endDate) return false;
  if (interventionDate < startDate || interventionDate > endDate) return false;

  if (!protocol.target_race_id) return true;
  return entry.race_id === protocol.target_race_id || entry.races?.id === protocol.target_race_id;
}

export function countMatchingProtocolEntries(protocol, interventions = []) {
  return interventions.filter((entry) => protocolMatchesIntervention(protocol, entry)).length;
}

export function calculateProtocolComplianceFromEntries(protocol, interventions = [], now = new Date()) {
  const expectedEntries = getExpectedEntriesForProtocol(protocol, now);
  const actualEntries = countMatchingProtocolEntries(protocol, interventions);

  if (!expectedEntries) {
    return {
      expected_entries: 0,
      actual_entries: actualEntries,
      compliance_percent: 0,
      weeks_elapsed: getElapsedProtocolWeeks(protocol, now),
    };
  }

  return {
    expected_entries: expectedEntries,
    actual_entries: actualEntries,
    compliance_percent: Math.min(100, Math.round((actualEntries / expectedEntries) * 100)),
    weeks_elapsed: getElapsedProtocolWeeks(protocol, now),
  };
}

export function getCurrentWeekBlock(protocol, now = new Date()) {
  const currentWeek = getCurrentProtocolWeek(protocol, now);
  const blocks = extractWeeklyBlocks(
    protocol?.instructions,
    protocol?.duration_weeks || calculateDurationWeeks(protocol?.start_date, protocol?.end_date)
  );

  return (
    blocks.find((block) => block.week_number === currentWeek) ||
    blocks[blocks.length - 1] ||
    null
  );
}

export function getProtocolPhase(protocolType) {
  return getInterventionDefinition(protocolType)?.phase || 'Protocol';
}

export function getProtocolStripeClass(protocolType) {
  const phase = getProtocolPhase(protocolType);
  if (phase === 'Before') return 'bg-amber-500';
  if (phase === 'During') return 'bg-sky-500';
  if (phase === 'After') return 'bg-emerald-500';
  if (phase === 'Check-in') return 'bg-stone-500';
  return 'bg-ink';
}

export function selectBestMatchingProtocol(protocols = [], { interventionType, interventionDate, raceId }) {
  const dateOnly = toDateOnly(interventionDate);
  if (!interventionType || !dateOnly) return null;

  const candidates = protocols.filter((protocol) => {
    if (!['assigned', 'in_progress'].includes(protocol.status)) return false;
    if (protocol.protocol_type !== interventionType) return false;
    if (dateOnly < toDateOnly(protocol.start_date) || dateOnly > toDateOnly(protocol.end_date)) return false;
    return true;
  });

  if (!candidates.length) return null;

  const exactRaceMatch = candidates.find((protocol) => raceId && protocol.target_race_id === raceId);
  if (exactRaceMatch) return exactRaceMatch;

  const openRaceCandidate = candidates.find((protocol) => !protocol.target_race_id);
  if (openRaceCandidate) return openRaceCandidate;

  return [...candidates].sort((left, right) => String(right.start_date).localeCompare(String(left.start_date)))[0];
}
