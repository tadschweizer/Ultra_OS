import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPORT_STATUSES,
  buildAthleteImportHealth,
  canSendFollowup,
  classifyImportJob,
  latestJobPerAthlete,
  summarizeImportHealth,
} from '../lib/importHealth.js';

function job(athleteId, createdAt, overrides = {}) {
  return {
    id: `${athleteId}-${createdAt}`,
    athlete_id: athleteId,
    status: 'completed',
    transferred_count: 100,
    needs_manual_mapping_count: 0,
    error_message: null,
    created_at: createdAt,
    ...overrides,
  };
}

test('classifyImportJob buckets each known status', () => {
  assert.equal(classifyImportJob(null), IMPORT_STATUSES.NOT_STARTED);
  assert.equal(classifyImportJob(job('a', '2026-07-01')), IMPORT_STATUSES.MIGRATED);
  assert.equal(classifyImportJob(job('a', '2026-07-01', { needs_manual_mapping_count: 7 })), IMPORT_STATUSES.NEEDS_MAPPING);
  assert.equal(classifyImportJob(job('a', '2026-07-01', { status: 'queued' })), IMPORT_STATUSES.IN_PROGRESS);
  assert.equal(classifyImportJob(job('a', '2026-07-01', { status: 'running' })), IMPORT_STATUSES.IN_PROGRESS);
  assert.equal(classifyImportJob(job('a', '2026-07-01', { status: 'failed' })), IMPORT_STATUSES.FAILED);
  assert.equal(classifyImportJob(job('a', '2026-07-01', { status: 'error' })), IMPORT_STATUSES.FAILED);
});

test('classifyImportJob normalizes case and routes unknown statuses to unknown', () => {
  assert.equal(classifyImportJob(job('a', '2026-07-01', { status: 'COMPLETED' })), IMPORT_STATUSES.MIGRATED);
  assert.equal(classifyImportJob(job('a', '2026-07-01', { status: 'weird-state' })), IMPORT_STATUSES.UNKNOWN);
  assert.equal(classifyImportJob(job('a', '2026-07-01', { status: null })), IMPORT_STATUSES.UNKNOWN);
});

test('latestJobPerAthlete picks the newest job per athlete', () => {
  const jobs = [
    job('a', '2026-07-03T10:00:00Z', { status: 'completed' }),
    job('a', '2026-07-01T10:00:00Z', { status: 'failed' }),
    job('b', '2026-06-20T08:00:00Z', { status: 'queued' }),
  ];
  const byAthlete = latestJobPerAthlete(jobs);
  assert.equal(byAthlete.a.created_at, '2026-07-03T10:00:00Z');
  assert.equal(byAthlete.b.status, 'queued');
});

test('latestJobPerAthlete handles empty and malformed input', () => {
  assert.deepEqual(latestJobPerAthlete([]), {});
  assert.deepEqual(latestJobPerAthlete(), {});
  assert.deepEqual(latestJobPerAthlete([{ status: 'completed' }]), {});
});

test('a newer successful job supersedes an old failure', () => {
  const byAthlete = latestJobPerAthlete([
    job('a', '2026-06-01T00:00:00Z', { status: 'failed', error_message: 'boom' }),
    job('a', '2026-07-01T00:00:00Z', { status: 'completed' }),
  ]);
  assert.equal(classifyImportJob(byAthlete.a), IMPORT_STATUSES.MIGRATED);
});

test('summarizeImportHealth counts every bucket including not-started athletes', () => {
  const jobsByAthlete = latestJobPerAthlete([
    job('a', '2026-07-01', { status: 'completed', needs_manual_mapping_count: 0 }),
    job('b', '2026-07-01', { status: 'completed', needs_manual_mapping_count: 7 }),
    job('c', '2026-07-01', { status: 'completed', needs_manual_mapping_count: 3 }),
    job('d', '2026-07-01', { status: 'running' }),
    job('e', '2026-07-01', { status: 'failed' }),
    job('f', '2026-07-01', { status: 'mystery' }),
  ]);
  const summary = summarizeImportHealth(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], jobsByAthlete);
  assert.deepEqual(summary, {
    migrated: 1,
    inProgress: 1,
    needsMapping: 2,
    failed: 1,
    notStarted: 2,
    unknown: 1,
    totalNeedsMappingItems: 10,
  });
});

test('summarizeImportHealth with empty roster returns all zeros', () => {
  const summary = summarizeImportHealth([], {});
  assert.equal(Object.values(summary).every((v) => v === 0), true);
});

test('buildAthleteImportHealth exposes error message only for failed jobs', () => {
  const failed = buildAthleteImportHealth(job('a', '2026-07-01', { status: 'failed', error_message: 'token expired' }));
  assert.equal(failed.importStatus, IMPORT_STATUSES.FAILED);
  assert.equal(failed.errorMessage, 'token expired');

  const completed = buildAthleteImportHealth(job('a', '2026-07-01', { error_message: 'stale note' }));
  assert.equal(completed.errorMessage, null);

  const none = buildAthleteImportHealth(null);
  assert.equal(none.importStatus, IMPORT_STATUSES.NOT_STARTED);
  assert.equal(none.transferredCount, 0);
  assert.equal(none.lastImportAt, null);
});

test('buildAthleteImportHealth carries the followup timestamp', () => {
  const health = buildAthleteImportHealth(job('a', '2026-07-01', {
    needs_manual_mapping_count: 4,
    followup_sent_at: '2026-07-02T10:00:00Z',
  }));
  assert.equal(health.followupSentAt, '2026-07-02T10:00:00Z');
  assert.equal(buildAthleteImportHealth(null).followupSentAt, null);
});

test('canSendFollowup allows only completed jobs with unmapped items and no prior followup', () => {
  const eligible = job('a', '2026-07-01', { needs_manual_mapping_count: 7 });
  assert.deepEqual(canSendFollowup(eligible), { ok: true, reason: null });
});

test('canSendFollowup rejects each ineligible case with a reason', () => {
  assert.equal(canSendFollowup(null).ok, false);

  const notCompleted = canSendFollowup(job('a', '2026-07-01', { status: 'running', needs_manual_mapping_count: 7 }));
  assert.equal(notCompleted.ok, false);
  assert.match(notCompleted.reason, /not completed/);

  const nothingToMap = canSendFollowup(job('a', '2026-07-01', { needs_manual_mapping_count: 0 }));
  assert.equal(nothingToMap.ok, false);
  assert.match(nothingToMap.reason, /no items/);

  const alreadySent = canSendFollowup(job('a', '2026-07-01', {
    needs_manual_mapping_count: 7,
    followup_sent_at: '2026-07-02T10:00:00Z',
  }));
  assert.equal(alreadySent.ok, false);
  assert.match(alreadySent.reason, /already sent/i);
});
