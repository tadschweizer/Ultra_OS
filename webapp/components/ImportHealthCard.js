import { IMPORT_STATUSES, IMPORT_STATUS_LABELS } from '../lib/importHealth';

const STATUS_PILL_CLASSES = {
  [IMPORT_STATUSES.MIGRATED]: 'bg-category-sleep/55 text-ink',
  [IMPORT_STATUSES.NEEDS_MAPPING]: 'bg-category-nutrition/70 text-ink',
  [IMPORT_STATUSES.IN_PROGRESS]: 'bg-sky-100 text-sky-800',
  [IMPORT_STATUSES.FAILED]: 'bg-category-respiratory/55 text-ink',
  [IMPORT_STATUSES.NOT_STARTED]: 'bg-ink/6 text-ink/55',
  [IMPORT_STATUSES.UNKNOWN]: 'bg-ink/6 text-ink/55',
};

function lastImportLabel(iso) {
  if (!iso) return 'No import yet';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Last import today';
  if (days === 1) return 'Last import yesterday';
  return `Last import ${days}d ago`;
}

export function ImportStatusPill({ status }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_PILL_CLASSES[status] || STATUS_PILL_CLASSES[IMPORT_STATUSES.UNKNOWN]}`}>
      {IMPORT_STATUS_LABELS[status] || 'Unknown'}
    </span>
  );
}

function summaryLine(summary) {
  if (!summary) return null;
  const parts = [];
  if (summary.migrated) parts.push(`${summary.migrated} migrated`);
  if (summary.needsMapping) parts.push(`${summary.needsMapping} need mapping (${summary.totalNeedsMappingItems} items)`);
  if (summary.inProgress) parts.push(`${summary.inProgress} in progress`);
  if (summary.failed) parts.push(`${summary.failed} failed`);
  if (summary.notStarted) parts.push(`${summary.notStarted} not started`);
  if (summary.unknown) parts.push(`${summary.unknown} unknown`);
  return parts.length ? parts.join(' · ') : 'No roster athletes yet';
}

export default function ImportHealthCard({ importHealth, relationships = [], renderRowAction }) {
  const activeRelationships = relationships.filter((rel) => rel.status === 'active');

  if (!activeRelationships.length) {
    return (
      <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
        <p className="text-sm uppercase tracking-[0.25em] text-accent">Roster import health</p>
        <p className="mt-4 text-sm text-ink/55">Invite athletes to your roster to track their TrainingPeaks migrations here.</p>
      </div>
    );
  }

  const athletes = importHealth?.athletes || {};

  return (
    <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent">Roster import health</p>
        <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/60">{summaryLine(importHealth?.summary)}</span>
      </div>
      <div className="mt-5 space-y-2">
        {activeRelationships.map((rel) => {
          const health = athletes[rel.athlete_id] || { importStatus: IMPORT_STATUSES.NOT_STARTED, transferredCount: 0, needsManualMappingCount: 0, lastImportAt: null };
          return (
            <div key={rel.athlete_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/8 bg-paper p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{rel.athlete?.name || 'Athlete'}</p>
                <p className="mt-0.5 text-xs text-ink/50">
                  {health.importStatus === IMPORT_STATUSES.NOT_STARTED
                    ? 'No TrainingPeaks import yet'
                    : `${health.transferredCount} transferred${health.needsManualMappingCount ? ` · ${health.needsManualMappingCount} need mapping` : ''} · ${lastImportLabel(health.lastImportAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ImportStatusPill status={health.importStatus} />
                {renderRowAction ? renderRowAction(rel, health) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
