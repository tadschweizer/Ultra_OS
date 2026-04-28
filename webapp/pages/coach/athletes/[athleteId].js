import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtocolAssignmentDrawer from '../../../components/ProtocolAssignmentDrawer';
import ProtocolComplianceRing from '../../../components/ProtocolComplianceRing';
import { getAllInterventionDefinitions, getInterventionIcon } from '../../../lib/interventionCatalog';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'interventions', label: 'Interventions' },
  { id: 'protocols', label: 'Protocols' },
  { id: 'race-prep', label: 'Race Prep' },
  { id: 'notes', label: 'Notes' },
];

const NOTE_TYPES = [
  { value: 'observation', label: 'Observation' },
  { value: 'flag', label: 'Flag' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'race_debrief', label: 'Race Debrief' },
];

function formatDate(value, options = {}) {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

function formatDateTime(value) {
  if (!value) return 'No timestamp';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No timestamp';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function differenceInDays(targetDate, baseDate = new Date()) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const base = new Date(baseDate);
  if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  base.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

function daysUntilLabel(value) {
  const diff = differenceInDays(value);
  if (diff === null) return 'No date';
  if (diff === 0) return 'Race day';
  if (diff === 1) return '1 day';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `${diff} days`;
}

function responseTone(score) {
  if (score >= 8) return 'bg-emerald-500';
  if (score >= 5) return 'bg-amber-500';
  if (score > 0) return 'bg-red-500';
  return 'bg-ink/12';
}

function protocolTone(value) {
  if (value > 80) return { stroke: '#16a34a', text: 'text-emerald-600' };
  if (value >= 60) return { stroke: '#d97706', text: 'text-amber-600' };
  return { stroke: '#dc2626', text: 'text-red-600' };
}

function buildHeatmapWeeks(interventions = [], weekCount = 20) {
  const entryMap = interventions.reduce((accumulator, item) => {
    const key = String(item.date || item.inserted_at || '').slice(0, 10);
    if (!key) return accumulator;
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - mondayOffset);

  return Array.from({ length: weekCount }).map((_, weekIndex) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - (weekCount - weekIndex - 1) * 7);

    return {
      key: weekStart.toISOString().slice(0, 10),
      days: Array.from({ length: 7 }).map((__, dayIndex) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayIndex);
        const key = date.toISOString().slice(0, 10);
        return {
          key,
          count: entryMap[key] || 0,
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        };
      }),
    };
  });
}

function heatmapClass(count) {
  if (count <= 0) return 'border border-white/8 bg-white/5';
  if (count === 1) return 'bg-amber-900/45';
  if (count <= 3) return 'bg-amber-700/65';
  if (count <= 5) return 'bg-amber-500/80';
  return 'bg-amber-300';
}

function groupRaces(interventions = []) {
  return Array.from(
    new Map(
      interventions
        .filter((entry) => entry.races?.id || entry.target_race)
        .map((entry) => [
          entry.races?.id || entry.target_race,
          {
            id: entry.races?.id || entry.target_race,
            name: entry.races?.name || entry.target_race,
          },
        ])
    ).values()
  );
}

function buildInterventionDateRange(range) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (range === '30d') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { start, end: null };
  }
  if (range === '90d') {
    const start = new Date(today);
    start.setDate(today.getDate() - 89);
    return { start, end: null };
  }
  return { start: null, end: null };
}

function ComplianceCircle({ value }) {
  return <ProtocolComplianceRing value={value} />;
}

function ScoreDots({ entry }) {
  const items = [
    { label: 'GI', value: entry.gi_response || 0 },
    { label: 'Physical', value: entry.physical_response || 0 },
    { label: 'Feel', value: entry.subjective_feel || 0 },
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${responseTone(item.value)}`} />
          <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function ContextComments({ messages = [] }) {
  if (!messages.length) {
    return (
      <p className="text-sm text-ink/58">No comments yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const coachMessage = message.sender_role === 'coach';
        return (
          <div key={message.id} className={`rounded-[18px] px-4 py-3 ${coachMessage ? 'bg-amber-100' : 'bg-white border border-border-subtle'}`}>
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
              {coachMessage ? 'Coach' : 'Athlete'} · {formatDateTime(message.created_at)}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink">{message.content}</p>
          </div>
        );
      })}
    </div>
  );
}

function QuickActionButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="inline-flex items-center justify-center rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-[1px] hover:bg-paper"
    >
      {children}
    </button>
  );
}

function AthleteSummaryHeader({ detail, onEditGroup, onSaveGroup, editingGroup, setEditingGroup, groupDraft, setGroupDraft, setActiveTab, onOpenAssign }) {
  const athlete = detail.athlete;
  const overview = detail.overview;
  const initials = String(athlete?.name || 'Athlete')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  return (
    <section className="ui-card">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/coach/dashboard" className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-paper text-ink">
            <span aria-hidden="true">←</span>
          </Link>

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-panel text-lg font-semibold text-paper">
            {initials}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-accent">Athlete detail</p>
            <h1 className="font-display mt-2 text-4xl text-ink">{athlete?.name || 'Athlete'}</h1>
            <p className="mt-2 text-sm text-ink/62">{athlete?.sport_label}</p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {editingGroup ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={groupDraft}
                    onChange={(event) => setGroupDraft(event.target.value)}
                    placeholder="Add group label"
                    className="ui-input w-[220px]"
                  />
                  <button onClick={onSaveGroup} className="ui-button-primary py-2">Save</button>
                  <button
                    onClick={() => {
                      setEditingGroup(false);
                      setGroupDraft(detail.relationship.group_name || '');
                    }}
                    className="ui-button-secondary py-2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={onEditGroup}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900"
                >
                  <span>{detail.relationship.group_name || 'No group label'}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-amber-700">Edit</span>
                </button>
              )}

              <span className="rounded-full bg-paper px-4 py-2 text-sm text-ink/70">
                Active since {formatDate(overview.active_since)}
              </span>
              <span className="rounded-full bg-paper px-4 py-2 text-sm text-ink/70">
                {overview.total_interventions} interventions logged
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/coach/athletes/${detail?.athlete?.id}/race-readiness`}
            className="inline-flex items-center justify-center rounded-full border border-ink/10 bg-panel px-4 py-2.5 text-sm font-semibold text-paper shadow-sm"
          >
            Race Readiness
          </Link>
          <QuickActionButton onClick={() => {
            setActiveTab('protocols');
            onOpenAssign();
          }}>Assign Protocol</QuickActionButton>
          <QuickActionButton onClick={() => setActiveTab('notes')}>Add Note</QuickActionButton>
          {athlete?.email ? (
            <Link
              href={`/messages?participant=${athlete.id}`}
              className="inline-flex items-center justify-center rounded-full border border-ink/10 bg-panel px-4 py-2.5 text-sm font-semibold text-paper shadow-sm"
            >
              Message
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center rounded-full border border-ink/10 bg-paper px-4 py-2.5 text-sm font-semibold text-ink/35">
              Message
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function AthleteTabs({ activeTab, setActiveTab }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-6 border-b border-ink/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-1 pb-4 pt-2 text-sm font-semibold transition ${
              activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-ink/55 hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ detail, interventions }) {
  const heatmapWeeks = useMemo(() => buildHeatmapWeeks(interventions), [interventions]);
  const upcomingRace = detail.overview.upcoming_race;
  const checklist = detail.overview.protocol_checklist;

  return (
    <div className="space-y-6">
      <section className="ui-card-dark">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Activity heatmap</p>
            <p className="mt-2 text-sm text-white/62">Days with logged interventions over the last {heatmapWeeks.length} weeks.</p>
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">Mon to Sun</div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="flex min-w-max gap-1">
            {heatmapWeeks.map((week) => (
              <div key={week.key} className="grid gap-1">
                {week.days.map((day) => (
                  <div
                    key={day.key}
                    title={`${day.label}: ${day.count} intervention${day.count === 1 ? '' : 's'}`}
                    className={`h-4 w-4 rounded-[4px] ${heatmapClass(day.count)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <section className="ui-card">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Recent interventions</p>
            <p className="mt-1 text-sm text-ink/58">Last 10 entries in coach review format.</p>
          </div>

          <div className="mt-5 space-y-3">
            {detail.overview.recent_interventions.length ? detail.overview.recent_interventions.map((entry) => (
              <div key={entry.id} className="rounded-[20px] border border-border-subtle bg-surface-light p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden="true">{getInterventionIcon(entry.intervention_type)}</span>
                      <p className="truncate text-sm font-semibold text-ink">{entry.intervention_type}</p>
                    </div>
                    <p className="mt-2 text-sm text-ink/58">{entry.summary}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/42">{formatDate(entry.date || entry.inserted_at)}</p>
                  </div>
                  <ScoreDots entry={entry} />
                </div>
              </div>
            )) : (
              <div className="rounded-[20px] border border-dashed border-border-subtle px-5 py-8 text-sm text-ink/58">
                No interventions logged yet.
              </div>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="ui-card">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Active protocols</p>
              <p className="mt-1 text-sm text-ink/58">Current assignments and weekly compliance.</p>
            </div>

            <div className="mt-5 space-y-4">
              {detail.overview.active_protocols.length ? detail.overview.active_protocols.map((protocol) => (
                <div key={protocol.id} className="flex items-center justify-between gap-4 rounded-[20px] border border-border-subtle bg-surface-light p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{protocol.protocol_name}</p>
                    <p className="mt-1 text-sm text-ink/60">{protocol.protocol_type}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/40">
                      {formatDate(protocol.start_date)} to {formatDate(protocol.end_date)}
                    </p>
                  </div>
                  <ComplianceCircle value={protocol.compliance} />
                </div>
              )) : (
                <div className="rounded-[20px] border border-dashed border-border-subtle px-5 py-8 text-sm text-ink/58">
                  No active protocols assigned.
                </div>
              )}
            </div>
          </section>

          <section className="ui-card">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Upcoming race</p>
            {upcomingRace ? (
              <div className="mt-4 rounded-[22px] bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl text-ink">{upcomingRace.name}</h3>
                    <p className="mt-2 text-sm text-ink/60">
                      {upcomingRace.race_type_label} · {formatDate(upcomingRace.event_date)}
                    </p>
                    <p className="mt-1 text-sm text-ink/60">{upcomingRace.location || 'Location not set'}</p>
                  </div>
                  <div className="rounded-[18px] bg-white px-4 py-3 text-right shadow-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-accent">Countdown</p>
                    <p className="mt-1 text-2xl font-semibold text-ink">{daysUntilLabel(upcomingRace.event_date)}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {checklist.length ? checklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/42">
                          Due {formatDate(item.dueDate)} · Target {item.target}%
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                        {item.complete ? 'Ready' : `${item.compliance}%`}
                      </span>
                    </div>
                  )) : (
                    <p className="text-sm text-ink/58">No protocol checklist items mapped to this race yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] border border-dashed border-border-subtle px-5 py-8 text-sm text-ink/58">
                No upcoming race is linked to this athlete yet.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InterventionDrawer({ entry, noteForm, setNoteForm, onSubmitNote, onClose, saving }) {
  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35 backdrop-blur-sm" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-[0_40px_120px_rgba(19,24,22,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-accent">Intervention detail</p>
            <h2 className="font-display mt-3 text-3xl text-ink">{entry.intervention_type}</h2>
            <p className="mt-2 text-sm text-ink/58">{formatDate(entry.date || entry.inserted_at)}</p>
          </div>
          <button onClick={onClose} className="ui-button-secondary py-2">Close</button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[20px] bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">GI</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{entry.gi_response ?? '—'}</p>
          </div>
          <div className="rounded-[20px] bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Physical</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{entry.physical_response ?? '—'}</p>
          </div>
          <div className="rounded-[20px] bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Feel</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{entry.subjective_feel ?? '—'}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-border-subtle bg-surface-light p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Summary</p>
              <p className="mt-3 text-sm leading-7 text-ink">{entry.summary || 'No structured summary available.'}</p>
            </div>

            <div className="rounded-[22px] border border-border-subtle bg-surface-light p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Context</p>
              <dl className="mt-4 space-y-4 text-sm text-ink/72">
                <div>
                  <dt className="font-semibold text-ink">Race</dt>
                  <dd>{entry.races?.name || entry.target_race || 'No linked race'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Training phase</dt>
                  <dd>{entry.training_phase || 'Not set'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Details</dt>
                  <dd>{entry.details || 'No additional detail'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Athlete notes</dt>
                  <dd>{entry.notes || 'No athlete note attached'}</dd>
                </div>
              </dl>
            </div>
          </div>

          <form onSubmit={onSubmitNote} className="rounded-[22px] border border-border-subtle bg-white p-5 shadow-warm">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Add coach note</p>
            <p className="mt-2 text-sm text-ink/58">This note will stay private to the coach view and be tied to this intervention.</p>

            <label className="mt-5 block text-xs uppercase tracking-[0.16em] text-ink/42">Note type</label>
            <select
              value={noteForm.note_type}
              onChange={(event) => setNoteForm((current) => ({ ...current, note_type: event.target.value }))}
              className="ui-input mt-2"
            >
              {NOTE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            <label className="mt-4 block text-xs uppercase tracking-[0.16em] text-ink/42">Private note</label>
            <textarea
              value={noteForm.content}
              onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))}
              rows={6}
              placeholder="Add your observation, flag, or reminder for this intervention."
              className="ui-input mt-2"
            />

            <button type="submit" disabled={saving} className="ui-button-primary mt-4 w-full">
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

function InterventionsTab({
  interventions,
  setSelectedEntry,
  filters,
  setFilters,
  openCommentId,
  setOpenCommentId,
  commentDraft,
  setCommentDraft,
  onSubmitComment,
  sendingMessage,
}) {
  const races = useMemo(() => groupRaces(interventions), [interventions]);
  const filteredInterventions = useMemo(() => {
    const { start, end } = buildInterventionDateRange(filters.dateRange);

    return interventions.filter((entry) => {
      if (filters.type !== 'all' && entry.intervention_type !== filters.type) return false;
      if (filters.race !== 'all' && (entry.races?.id || entry.target_race) !== filters.race) return false;
      if (entry.response_score < Number(filters.minScore || 0)) return false;
      if (entry.response_score > Number(filters.maxScore || 10)) return false;

      if (start || end) {
        const entryDate = new Date(`${String(entry.date || entry.inserted_at).slice(0, 10)}T00:00:00`);
        if (Number.isNaN(entryDate.getTime())) return false;
        if (start && entryDate < start) return false;
        if (end && entryDate > end) return false;
      }

      return true;
    });
  }, [filters, interventions]);

  const types = useMemo(() => Array.from(new Set(interventions.map((entry) => entry.intervention_type).filter(Boolean))), [interventions]);

  return (
    <div className="space-y-6">
      <section className="ui-card">
        <div className="grid gap-3 lg:grid-cols-4">
          <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} className="ui-input">
            <option value="all">All types</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={filters.dateRange} onChange={(event) => setFilters((current) => ({ ...current, dateRange: event.target.value }))} className="ui-input">
            <option value="all">All dates</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <select value={filters.race} onChange={(event) => setFilters((current) => ({ ...current, race: event.target.value }))} className="ui-input">
            <option value="all">All races</option>
            {races.map((race) => <option key={race.id} value={race.id}>{race.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min="0"
              max="10"
              value={filters.minScore}
              onChange={(event) => setFilters((current) => ({ ...current, minScore: event.target.value }))}
              className="ui-input"
              placeholder="Min score"
            />
            <input
              type="number"
              min="0"
              max="10"
              value={filters.maxScore}
              onChange={(event) => setFilters((current) => ({ ...current, maxScore: event.target.value }))}
              className="ui-input"
              placeholder="Max score"
            />
          </div>
        </div>
      </section>

      <section className="ui-card overflow-x-auto">
        <table className="min-w-full text-left text-sm text-ink">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.18em] text-ink/50">
              <th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Race</th>
              <th className="pb-3 pr-4">Summary</th>
              <th className="pb-3 pr-4">Response</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInterventions.length ? filteredInterventions.flatMap((entry) => {
              const commentsOpen = openCommentId === entry.id;

              return [
                <tr key={entry.id} className="border-b border-ink/8 align-top">
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden="true">{getInterventionIcon(entry.intervention_type)}</span>
                      <span className="font-semibold">{entry.intervention_type}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4">{formatDate(entry.date || entry.inserted_at)}</td>
                  <td className="py-4 pr-4">{entry.races?.name || entry.target_race || '—'}</td>
                  <td className="py-4 pr-4 text-ink/68">
                    <p>{entry.summary}</p>
                    {entry.context_messages?.length ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-700">
                        {entry.context_messages.length} comment{entry.context_messages.length === 1 ? '' : 's'}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-4 pr-4"><ScoreDots entry={entry} /></td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setSelectedEntry(entry)} className="ui-button-secondary py-2">
                        View detail
                      </button>
                      <button
                        onClick={() => {
                          setOpenCommentId(commentsOpen ? null : entry.id);
                          setCommentDraft('');
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
                      >
                        <span>Comment</span>
                      </button>
                    </div>
                  </td>
                </tr>,
                commentsOpen ? (
                  <tr key={`${entry.id}-comments`} className="border-b border-ink/8">
                    <td colSpan="6" className="pb-5 pl-4 pr-4">
                      <div className="rounded-[22px] bg-paper p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-accent">Intervention comments</p>
                        <div className="mt-4">
                          <ContextComments messages={entry.context_messages || []} />
                        </div>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            onSubmitComment('intervention', entry.id, commentDraft);
                          }}
                          className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <input
                            value={commentDraft}
                            onChange={(event) => setCommentDraft(event.target.value)}
                            placeholder="Comment on this intervention entry."
                            className="ui-input"
                          />
                          <button type="submit" disabled={sendingMessage || !commentDraft.trim()} className="ui-button-primary">
                            {sendingMessage ? 'Sending…' : 'Send comment'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ) : null,
              ];
            }) : (
              <tr>
                <td colSpan="6" className="py-8 text-center text-sm text-ink/58">No interventions match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ProtocolsTab({
  protocols,
  onOpenAssign,
  expandedProtocolId,
  setExpandedProtocolId,
  openCommentId,
  setOpenCommentId,
  commentDraft,
  setCommentDraft,
  onSubmitComment,
  sendingMessage,
}) {
  return (
    <div className="space-y-6">
      <section className="ui-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Protocol Assignment Engine</p>
            <p className="mt-1 text-sm text-ink/58">
              Assign from a reusable template or build a custom protocol for this athlete in a guided flow.
            </p>
          </div>
          <button onClick={onOpenAssign} className="ui-button-primary">
            Assign Protocol
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {protocols.length ? protocols.map((protocol) => {
          const expanded = expandedProtocolId === protocol.id;
          return (
            <section key={protocol.id} className="ui-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <ComplianceCircle value={protocol.compliance} />
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{protocol.protocol_name}</h3>
                    <p className="mt-1 text-sm text-ink/62">{protocol.protocol_type}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/42">
                      {formatDate(protocol.start_date)} to {formatDate(protocol.end_date)} · {protocol.status}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/70">
                    Target {protocol.compliance_target}%
                  </span>
                  <button
                    onClick={() => {
                      setOpenCommentId(openCommentId === protocol.id ? null : protocol.id);
                      setCommentDraft('');
                    }}
                    className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
                  >
                    Comment
                  </button>
                  <button onClick={() => setExpandedProtocolId(expanded ? null : protocol.id)} className="ui-button-secondary py-2">
                    {expanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              {openCommentId === protocol.id ? (
                <div className="mt-5 rounded-[22px] bg-paper p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-accent">Protocol comments</p>
                  <div className="mt-4">
                    <ContextComments messages={protocol.context_messages || []} />
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      onSubmitComment('protocol', protocol.id, commentDraft);
                    }}
                    className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <input
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Comment on compliance or protocol progress."
                      className="ui-input"
                    />
                    <button type="submit" disabled={sendingMessage || !commentDraft.trim()} className="ui-button-primary">
                      {sendingMessage ? 'Sending…' : 'Send comment'}
                    </button>
                  </form>
                </div>
              ) : null}

              {expanded ? (
                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="rounded-[22px] bg-paper p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-accent">Instructions</p>
                      {protocol.instructions_list.length ? (
                        <div className="mt-4 space-y-2">
                          {protocol.instructions_list.map((item, index) => (
                            <p key={`${protocol.id}-instruction-${index}`} className="text-sm leading-7 text-ink/72">{item}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-ink/58">{protocol.description || 'No instructions stored for this protocol yet.'}</p>
                      )}
                    </div>

                    <div className="rounded-[22px] bg-paper p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-accent">Matching entries</p>
                      <div className="mt-4 space-y-3">
                        {protocol.matching_interventions.length ? protocol.matching_interventions.map((entry) => (
                          <div key={entry.id} className="rounded-[18px] bg-white px-4 py-3 shadow-sm">
                            <p className="text-sm font-semibold text-ink">{formatDate(entry.date || entry.inserted_at)}</p>
                            <p className="mt-1 text-sm text-ink/62">{entry.summary}</p>
                          </div>
                        )) : (
                          <p className="text-sm text-ink/58">No logged entries currently count toward this protocol.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-paper p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-accent">Current Week Focus</p>
                    <div className="mt-5 rounded-[18px] bg-white px-4 py-4 shadow-sm">
                      <p className="text-sm font-semibold text-ink">
                        {protocol.current_week_block?.instruction_text || 'No current-week instruction is stored yet.'}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/42">
                        {protocol.current_week_block?.frequency_per_week ? `${protocol.current_week_block.frequency_per_week}x/week` : 'Frequency not set'}
                        {protocol.current_week_block?.frequency_per_week && protocol.current_week_block?.target_metric ? ' · ' : ''}
                        {protocol.current_week_block?.target_metric || ''}
                      </p>
                    </div>
                    <div className="mt-4 space-y-4">
                      {protocol.timeline.length ? protocol.timeline.map((item) => (
                        <div key={`${protocol.id}-timeline-${item.id}`} className="relative pl-6">
                          <span className="absolute left-0 top-1 h-3 w-3 rounded-full bg-accent" />
                          <div className="rounded-[18px] bg-white px-4 py-3 shadow-sm">
                            <p className="text-sm font-semibold text-ink">{formatDate(item.date)}</p>
                            <p className="mt-1 text-sm text-ink/62">{item.summary}</p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-ink/58">Timeline will populate as matching interventions are logged.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          );
        }) : (
          <section className="ui-card text-sm text-ink/58">No protocols have been assigned yet.</section>
        )}
      </div>
    </div>
  );
}

function RacePrepTab({ detail }) {
  const upcomingRace = detail.overview.upcoming_race;
  const milestones = detail.overview.race_milestones;
  const checklist = detail.overview.protocol_checklist;

  if (!upcomingRace) {
    return (
      <section className="ui-card">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Race prep</p>
        <p className="mt-3 text-sm leading-7 text-ink/62">
          No upcoming race is connected to this athlete yet. Add or link a race first so Threshold can map protocols and milestones.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="ui-card">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="rounded-[24px] border border-border-subtle bg-surface-light p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Race Architecture Builder</p>
            <h2 className="font-display mt-3 text-3xl text-ink">{upcomingRace.name}</h2>
            <p className="mt-3 text-sm text-ink/62">
              {upcomingRace.race_type_label} · {formatDate(upcomingRace.event_date)} · {upcomingRace.location || 'Location not set'}
            </p>
            <p className="mt-5 text-sm leading-7 text-ink/68">
              Threshold currently builds the race architecture on the athlete-side Race Blueprint page. There is no stored coach-side output yet, so this screen can show the linked race context and readiness checklist, but not a saved architecture document.
            </p>
            <Link href="/race-plan" className="ui-button-primary mt-6">
              Open Race Blueprint
            </Link>
          </div>

          <div className="rounded-[24px] border border-border-subtle bg-white p-6 shadow-warm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Countdown</p>
            <p className="mt-3 text-4xl font-semibold text-ink">{daysUntilLabel(upcomingRace.event_date)}</p>
            <p className="mt-2 text-sm text-ink/58">to {upcomingRace.name}</p>

            <div className="mt-6 space-y-3">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="flex items-center justify-between rounded-[18px] bg-paper px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{milestone.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/42">{milestone.dateLabel}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    milestone.state === 'complete'
                      ? 'bg-emerald-100 text-emerald-700'
                      : milestone.state === 'current'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-white text-ink/55'
                  }`}>
                    {milestone.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Protocol completion checklist</p>
        <div className="mt-5 space-y-3">
          {checklist.length ? checklist.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-[20px] border border-border-subtle bg-surface-light p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <p className="mt-1 text-sm text-ink/60">
                  Due {formatDate(item.dueDate)}{item.raceName ? ` · ${item.raceName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/68">
                  Compliance {item.compliance}% / target {item.target}%
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                  {item.complete ? 'Complete' : 'In progress'}
                </span>
              </div>
            </div>
          )) : (
            <p className="text-sm text-ink/58">No protocol checklist items are mapped to the current race.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function NotesTab({ notes, noteFilter, setNoteFilter, noteForm, setNoteForm, onSubmitNote, saving, onTogglePin }) {
  const filteredNotes = useMemo(() => {
    if (noteFilter === 'all') return notes;
    return notes.filter((note) => note.note_type === noteFilter);
  }, [noteFilter, notes]);

  const pinnedNotes = filteredNotes.filter((note) => note.is_pinned);
  const remainingNotes = filteredNotes.filter((note) => !note.is_pinned);

  return (
    <div className="space-y-6">
      <section className="ui-card">
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-ink/42">Filter notes</label>
            <select value={noteFilter} onChange={(event) => setNoteFilter(event.target.value)} className="ui-input mt-2">
              <option value="all">All note types</option>
              {NOTE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>

          <form onSubmit={onSubmitNote} className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
            <select
              value={noteForm.note_type}
              onChange={(event) => setNoteForm((current) => ({ ...current, note_type: event.target.value }))}
              className="ui-input"
            >
              {NOTE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <input
              value={noteForm.content}
              onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))}
              placeholder="Add a private coach note."
              className="ui-input"
              required
            />
            <button type="submit" disabled={saving} className="ui-button-primary">
              {saving ? 'Saving…' : 'Add note'}
            </button>
          </form>
        </div>
      </section>

      {pinnedNotes.length ? (
        <section className="ui-card">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Pinned notes</p>
          <div className="mt-5 space-y-3">
            {pinnedNotes.map((note) => (
              <article key={note.id} className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-800">{note.note_type}</p>
                    <p className="mt-2 text-sm leading-7 text-ink">{note.content}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-ink/42">{formatDateTime(note.created_at)}</p>
                  </div>
                  <button onClick={() => onTogglePin(note)} className="ui-button-secondary py-2">Unpin</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ui-card">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">All notes</p>
        <div className="mt-5 space-y-3">
          {remainingNotes.length ? remainingNotes.map((note) => (
            <article key={note.id} className="rounded-[20px] border border-border-subtle bg-surface-light p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">{note.note_type}</p>
                  <p className="mt-2 text-sm leading-7 text-ink">{note.content}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-ink/42">{formatDateTime(note.created_at)}</p>
                </div>
                <button onClick={() => onTogglePin(note)} className="ui-button-secondary py-2">Pin</button>
              </div>
            </article>
          )) : (
            <p className="text-sm text-ink/58">No notes match this filter yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <main className="ui-shell">
      <div className="ui-card">
        <div className="ui-skeleton h-6 w-40 rounded-full" />
        <div className="ui-skeleton mt-4 h-12 w-72 rounded-full" />
        <div className="ui-skeleton mt-6 h-10 w-full rounded-[20px]" />
      </div>
    </main>
  );
}

export default function CoachAthleteDetailPage() {
  const router = useRouter();
  const { athleteId } = router.query;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [interventionFilters, setInterventionFilters] = useState({
    type: 'all',
    dateRange: 'all',
    race: 'all',
    minScore: '0',
    maxScore: '10',
  });
  const [drawerNoteForm, setDrawerNoteForm] = useState({ note_type: 'observation', content: '' });
  const [inlineNoteForm, setInlineNoteForm] = useState({ note_type: 'observation', content: '' });
  const [noteFilter, setNoteFilter] = useState('all');
  const [templates, setTemplates] = useState([]);
  const [assignmentDrawerOpen, setAssignmentDrawerOpen] = useState(false);
  const [expandedProtocolId, setExpandedProtocolId] = useState(null);
  const [savingNote, setSavingNote] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [openInterventionCommentId, setOpenInterventionCommentId] = useState(null);
  const [openProtocolCommentId, setOpenProtocolCommentId] = useState(null);
  const [interventionCommentDraft, setInterventionCommentDraft] = useState('');
  const [protocolCommentDraft, setProtocolCommentDraft] = useState('');

  const loadDetail = useCallback(async () => {
    if (!athleteId || Array.isArray(athleteId)) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/coach/athletes/${athleteId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load athlete detail.');
      }

      setDetail(data);
      setGroupDraft(data.relationship?.group_name || '');
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!detail) return;

    if (typeof router.query.tab === 'string') {
      setActiveTab(router.query.tab);
    }

    if (typeof router.query.entry === 'string') {
      const matchingEntry = (detail.interventions || []).find((entry) => entry.id === router.query.entry);
      if (matchingEntry) {
        setActiveTab('interventions');
        setSelectedEntry(matchingEntry);
      }
    }

    if (typeof router.query.protocol === 'string') {
      setActiveTab('protocols');
      setExpandedProtocolId(router.query.protocol);
    }
  }, [detail, router.query.entry, router.query.protocol, router.query.tab]);

  useEffect(() => {
    if (!athleteId || Array.isArray(athleteId)) return;

    async function loadTemplates() {
      try {
        const response = await fetch('/api/coach/templates');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load templates.');
        }
        setTemplates([...(data.templates || []), ...(data.sharedTemplates || [])]);
      } catch (templateError) {
        setError(templateError.message);
      }
    }

    loadTemplates();
  }, [athleteId]);

  const saveGroup = useCallback(async () => {
    if (!detail?.relationship?.id) return;

    try {
      const response = await fetch('/api/coach/relationships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: detail.relationship.id, group_name: groupDraft.trim() || null }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not update group label.');
      }

      setDetail((current) => ({
        ...current,
        relationship: {
          ...current.relationship,
          group_name: data.relationship.group_name,
        },
      }));
      setEditingGroup(false);
    } catch (saveError) {
      setError(saveError.message);
    }
  }, [detail, groupDraft]);

  const submitNote = useCallback(async (formState, extraPayload = {}) => {
    if (!detail?.athlete?.id || !formState.content.trim()) return false;
    setSavingNote(true);

    try {
      const response = await fetch('/api/coach/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_id: detail.athlete.id,
          content: formState.content.trim(),
          note_type: formState.note_type,
          ...extraPayload,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not save note.');
      }

      setDetail((current) => ({
        ...current,
        notes: [data.note, ...(current.notes || [])],
        overview: {
          ...current.overview,
          total_notes: (current.overview?.total_notes || 0) + 1,
        },
      }));

      return true;
    } catch (noteError) {
      setError(noteError.message);
      return false;
    } finally {
      setSavingNote(false);
    }
  }, [detail]);

  const togglePin = useCallback(async (note) => {
    try {
      const response = await fetch('/api/coach/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id, is_pinned: !note.is_pinned }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not update note.');
      }

      setDetail((current) => ({
        ...current,
        notes: current.notes
          .map((item) => item.id === note.id ? data.note : item)
          .sort((left, right) => Number(right.is_pinned) - Number(left.is_pinned) || new Date(right.created_at) - new Date(left.created_at)),
      }));
    } catch (toggleError) {
      setError(toggleError.message);
    }
  }, []);

  const handleProtocolAssigned = useCallback(async (protocol) => {
    await loadDetail();
    setExpandedProtocolId(protocol?.id || null);
    setAssignmentDrawerOpen(false);
  }, [loadDetail]);

  const submitContextComment = useCallback(async (contextType, contextId, content) => {
    if (!detail?.athlete?.id || !content.trim()) return;

    setSendingMessage(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_athlete_id: detail.athlete.id,
          content: content.trim(),
          context_type: contextType,
          context_id: contextId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send comment.');

      setDetail((current) => ({
        ...current,
        interventions: current.interventions.map((entry) => (
          contextType === 'intervention' && entry.id === contextId
            ? { ...entry, context_messages: [...(entry.context_messages || []), data.message] }
            : entry
        )),
        protocols: current.protocols.map((protocol) => (
          contextType === 'protocol' && protocol.id === contextId
            ? { ...protocol, context_messages: [...(protocol.context_messages || []), data.message] }
            : protocol
        )),
        overview: {
          ...current.overview,
          recent_interventions: current.overview.recent_interventions.map((entry) => (
            contextType === 'intervention' && entry.id === contextId
              ? { ...entry, context_messages: [...(entry.context_messages || []), data.message] }
              : entry
          )),
          active_protocols: current.overview.active_protocols.map((protocol) => (
            contextType === 'protocol' && protocol.id === contextId
              ? { ...protocol, context_messages: [...(protocol.context_messages || []), data.message] }
              : protocol
          )),
        },
      }));

      if (contextType === 'intervention') {
        setInterventionCommentDraft('');
      } else {
        setProtocolCommentDraft('');
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSendingMessage(false);
    }
  }, [detail]);

  const interventions = detail?.interventions || [];
  const protocols = detail?.protocols || [];
  const notes = detail?.notes || [];
  const interventionTypes = useMemo(
    () => getAllInterventionDefinitions().map((definition) => definition.label),
    []
  );

  if (loading) {
    return <LoadingState />;
  }

  if (error && !detail) {
    return (
      <main className="ui-shell">
        <div className="ui-card">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button onClick={loadDetail} className="ui-button-primary mt-4">Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-shell text-ink">
      <div className="space-y-6">
        {error ? (
          <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <AthleteSummaryHeader
          detail={detail}
          editingGroup={editingGroup}
          groupDraft={groupDraft}
          onEditGroup={() => setEditingGroup(true)}
          onOpenAssign={() => setAssignmentDrawerOpen(true)}
          onSaveGroup={saveGroup}
          setEditingGroup={setEditingGroup}
          setGroupDraft={setGroupDraft}
          setActiveTab={setActiveTab}
        />

        <AthleteTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'overview' ? <OverviewTab detail={detail} interventions={interventions} /> : null}
        {activeTab === 'interventions' ? (
          <InterventionsTab
            interventions={interventions}
            setSelectedEntry={setSelectedEntry}
            filters={interventionFilters}
            setFilters={setInterventionFilters}
            openCommentId={openInterventionCommentId}
            setOpenCommentId={setOpenInterventionCommentId}
            commentDraft={interventionCommentDraft}
            setCommentDraft={setInterventionCommentDraft}
            onSubmitComment={submitContextComment}
            sendingMessage={sendingMessage}
          />
        ) : null}
        {activeTab === 'protocols' ? (
          <ProtocolsTab
            protocols={protocols}
            onOpenAssign={() => setAssignmentDrawerOpen(true)}
            expandedProtocolId={expandedProtocolId}
            setExpandedProtocolId={setExpandedProtocolId}
            openCommentId={openProtocolCommentId}
            setOpenCommentId={setOpenProtocolCommentId}
            commentDraft={protocolCommentDraft}
            setCommentDraft={setProtocolCommentDraft}
            onSubmitComment={submitContextComment}
            sendingMessage={sendingMessage}
          />
        ) : null}
        {activeTab === 'race-prep' ? <RacePrepTab detail={detail} /> : null}
        {activeTab === 'notes' ? (
          <NotesTab
            notes={notes}
            noteFilter={noteFilter}
            setNoteFilter={setNoteFilter}
            noteForm={inlineNoteForm}
            setNoteForm={setInlineNoteForm}
            saving={savingNote}
            onSubmitNote={async (event) => {
              event.preventDefault();
              const ok = await submitNote(inlineNoteForm);
              if (ok) {
                setInlineNoteForm({ note_type: 'observation', content: '' });
              }
            }}
            onTogglePin={togglePin}
          />
        ) : null}
      </div>

      <InterventionDrawer
        entry={selectedEntry}
        noteForm={drawerNoteForm}
        setNoteForm={setDrawerNoteForm}
        saving={savingNote}
        onClose={() => {
          setSelectedEntry(null);
          setDrawerNoteForm({ note_type: 'observation', content: '' });
        }}
        onSubmitNote={async (event) => {
          event.preventDefault();
          const ok = await submitNote(drawerNoteForm, { related_intervention_id: selectedEntry?.id });
          if (ok) {
            setDrawerNoteForm({ note_type: 'observation', content: '' });
            setSelectedEntry(null);
          }
        }}
      />

      <ProtocolAssignmentDrawer
        open={assignmentDrawerOpen}
        onClose={() => setAssignmentDrawerOpen(false)}
        athleteName={detail?.athlete?.name || 'Athlete'}
        athleteId={detail?.athlete?.id}
        races={detail?.races || []}
        templates={templates}
        interventionTypes={interventionTypes}
        onAssigned={handleProtocolAssigned}
      />
    </main>
  );
}
