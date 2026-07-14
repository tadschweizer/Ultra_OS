// Pure helpers for the coach-facing TrainingPeaks import-health rollup.
// `trainingpeaks_import_jobs.status` is free text with no CHECK constraint;
// no writer exists in-code yet, so the recognized set is the column default
// ('queued') plus the states the plan docs define ('running', 'completed',
// 'failed'/'error'). Unknown strings land in the 'unknown' bucket instead of
// throwing.

export const IMPORT_STATUSES = {
  MIGRATED: 'migrated',
  NEEDS_MAPPING: 'needs_mapping',
  IN_PROGRESS: 'in_progress',
  FAILED: 'failed',
  NOT_STARTED: 'not_started',
  UNKNOWN: 'unknown',
};

export function classifyImportJob(job) {
  if (!job) return IMPORT_STATUSES.NOT_STARTED;
  const status = String(job.status || '').toLowerCase();
  const needsMapping = Number(job.needs_manual_mapping_count || 0);
  if (status === 'completed') {
    return needsMapping > 0 ? IMPORT_STATUSES.NEEDS_MAPPING : IMPORT_STATUSES.MIGRATED;
  }
  if (status === 'queued' || status === 'running') return IMPORT_STATUSES.IN_PROGRESS;
  if (status === 'failed' || status === 'error') return IMPORT_STATUSES.FAILED;
  return IMPORT_STATUSES.UNKNOWN;
}

export function latestJobPerAthlete(jobs = []) {
  const byAthlete = {};
  for (const job of jobs) {
    if (!job?.athlete_id) continue;
    const current = byAthlete[job.athlete_id];
    if (!current || new Date(job.created_at || 0) > new Date(current.created_at || 0)) {
      byAthlete[job.athlete_id] = job;
    }
  }
  return byAthlete;
}

export function buildAthleteImportHealth(job) {
  const importStatus = classifyImportJob(job);
  return {
    jobId: job?.id || null,
    importStatus,
    transferredCount: Number(job?.transferred_count || 0),
    needsManualMappingCount: Number(job?.needs_manual_mapping_count || 0),
    lastImportAt: job?.created_at || null,
    errorMessage: importStatus === IMPORT_STATUSES.FAILED ? (job?.error_message || null) : null,
    followupSentAt: job?.followup_sent_at || null,
  };
}

/**
 * A coach may send a mapping follow-up only for a completed job that still
 * has unmapped items and hasn't been followed up on. Returns a reason string
 * suitable for an API error body when not eligible.
 */
export function canSendFollowup(job) {
  if (!job) return { ok: false, reason: 'Import job not found.' };
  if (String(job.status || '').toLowerCase() !== 'completed') {
    return { ok: false, reason: 'The import has not completed yet.' };
  }
  if (!(Number(job.needs_manual_mapping_count) > 0)) {
    return { ok: false, reason: 'This import has no items needing manual mapping.' };
  }
  if (job.followup_sent_at) {
    return { ok: false, reason: 'Follow-up already sent.' };
  }
  return { ok: true, reason: null };
}

export function summarizeImportHealth(athleteIds = [], jobsByAthlete = {}) {
  const summary = {
    migrated: 0,
    inProgress: 0,
    needsMapping: 0,
    failed: 0,
    notStarted: 0,
    unknown: 0,
    totalNeedsMappingItems: 0,
  };
  for (const athleteId of athleteIds) {
    const job = jobsByAthlete[athleteId] || null;
    const status = classifyImportJob(job);
    if (status === IMPORT_STATUSES.MIGRATED) summary.migrated += 1;
    else if (status === IMPORT_STATUSES.NEEDS_MAPPING) {
      summary.needsMapping += 1;
      summary.totalNeedsMappingItems += Number(job?.needs_manual_mapping_count || 0);
    } else if (status === IMPORT_STATUSES.IN_PROGRESS) summary.inProgress += 1;
    else if (status === IMPORT_STATUSES.FAILED) summary.failed += 1;
    else if (status === IMPORT_STATUSES.NOT_STARTED) summary.notStarted += 1;
    else summary.unknown += 1;
  }
  return summary;
}

export const IMPORT_STATUS_LABELS = {
  [IMPORT_STATUSES.MIGRATED]: 'Migrated',
  [IMPORT_STATUSES.NEEDS_MAPPING]: 'Needs mapping',
  [IMPORT_STATUSES.IN_PROGRESS]: 'In progress',
  [IMPORT_STATUSES.FAILED]: 'Failed',
  [IMPORT_STATUSES.NOT_STARTED]: 'Not started',
  [IMPORT_STATUSES.UNKNOWN]: 'Unknown',
};
