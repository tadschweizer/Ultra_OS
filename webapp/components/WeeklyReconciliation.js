import { useEffect, useMemo, useState } from 'react';
import { summarizeReconciliationWindow, toDateKey } from '../lib/workoutCompliance';

const STATUS_TONES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  yellow: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-rose-200 bg-rose-50 text-rose-700',
  none: 'border-ink/10 bg-white text-ink/50',
};

function statusLabel(workout) {
  if (workout.status === 'completed') {
    return workout.compliance_pct != null ? `${workout.compliance_pct}%` : 'Done';
  }
  if (workout.status === 'skipped') return 'Skipped';
  return workout.compliance_status === 'red' ? 'Missed' : 'Upcoming';
}

function fmtMin(min) {
  if (min == null) return null;
  const rounded = Math.round(Number(min));
  if (!Number.isFinite(rounded) || rounded <= 0) return null;
  if (rounded < 60) return `${rounded}m`;
  return `${Math.floor(rounded / 60)}h${rounded % 60 ? ` ${rounded % 60}m` : ''}`;
}

function dayLabel(key) {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Presentational: renders a reconciliation summary produced by summarizeReconciliationWindow. */
export function ReconciliationSummary({ summary, title = 'This week: planned vs completed' }) {
  if (!summary) return null;
  const { plannedCount, completedCount, missedCount, upcomingCount, avgCompliancePct, unplannedActivities, days } = summary;

  if (plannedCount === 0 && unplannedActivities.length === 0) return null;

  const headline = [
    `${completedCount} of ${plannedCount} planned session${plannedCount === 1 ? '' : 's'} completed`,
    avgCompliancePct != null ? `${avgCompliancePct}% avg compliance` : null,
    missedCount > 0 ? `${missedCount} missed` : null,
    upcomingCount > 0 ? `${upcomingCount} upcoming` : null,
    unplannedActivities.length > 0 ? `${unplannedActivities.length} unplanned` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-[28px] border border-ink/10 bg-white/70 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50">{title}</p>
        <p className="text-xs font-semibold text-ink/70">{headline}</p>
      </div>
      <ul className="mt-3 divide-y divide-ink/5">
        {days.map((day) => (
          <li key={day.key} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-4">
            <p className="w-24 shrink-0 text-xs font-semibold text-ink/60">{dayLabel(day.key)}</p>
            <div className="flex-1 space-y-1">
              {day.workouts.map((w) => {
                const planned = fmtMin(w.planned_duration_min);
                const completed = fmtMin(w.completed_duration_min);
                return (
                  <div key={w.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink">{w.title || w.sport || 'Workout'}</span>
                    <span className="text-xs text-ink/50">
                      {planned ? `planned ${planned}` : 'no target'}
                      {completed ? ` → did ${completed}` : ''}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONES[w.compliance_status] || STATUS_TONES.none}`}>
                      {statusLabel(w)}
                    </span>
                  </div>
                );
              })}
              {day.unplannedActivities.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-ink/70">{a.name || 'Activity'}</span>
                  <span className="text-xs text-ink/50">{fmtMin((Number(a.moving_time) || 0) / 60) || ''}</span>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                    Unplanned
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Self-fetching wrapper for the athlete's current week (Mon–Sun): loads
 * planned workouts and synced activities, reconciles, and renders the
 * summary. Renders nothing while loading, on error, or with no data —
 * the calendar below remains the primary surface.
 */
export default function WeeklyReconciliation() {
  const [workouts, setWorkouts] = useState(null);
  const [activities, setActivities] = useState(null);
  // One stable "now" for the whole render pass (avoids status flapping).
  const [today] = useState(() => new Date());

  const weekStart = useMemo(() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday = 0
    return toDateKey(d);
  }, [today]);
  const weekEnd = useMemo(() => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + 6);
    return toDateKey(d);
  }, [weekStart]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/planned-workouts?start=${weekStart}&end=${weekEnd}`)
      .then((res) => (res.ok ? res.json() : { workouts: [] }))
      .then((data) => { if (!cancelled) setWorkouts(data.workouts || []); })
      .catch(() => { if (!cancelled) setWorkouts([]); });
    fetch('/api/activities')
      .then((res) => (res.ok ? res.json() : { activities: [] }))
      .then((data) => { if (!cancelled) setActivities(data.activities || []); })
      .catch(() => { if (!cancelled) setActivities([]); });
    return () => { cancelled = true; };
  }, [weekStart, weekEnd]);

  const summary = useMemo(() => {
    if (!workouts || !activities) return null;
    return summarizeReconciliationWindow(workouts, activities, { start: weekStart, end: weekEnd, today });
  }, [workouts, activities, weekStart, weekEnd, today]);

  return <ReconciliationSummary summary={summary} />;
}
