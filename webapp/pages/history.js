import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import { buildProtocolSummary } from '../lib/interventionCatalog';

const categoryBadgeClasses = [
  'bg-category-heat/55 text-ink',
  'bg-category-gut/55 text-ink',
  'bg-category-respiratory/55 text-ink',
  'bg-category-supplementation/55 text-ink',
  'bg-category-recovery/55 text-ink',
];

const dateRangePresets = ['This Week', 'Last 30D', 'Last 90D', 'All Time', 'Custom'];
const calendarWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatRaceSummary(race) {
  if (!race) return 'No saved race profile';
  const parts = [];
  if (race.event_date) parts.push(race.event_date);
  if (race.location) parts.push(race.location);
  if (race.distance_miles) parts.push(`${Number(race.distance_miles).toFixed(1)} mi`);
  return parts.join(' - ') || 'Saved race profile';
}

function formatDate(value) {
  if (!value) return 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function getOutcomeScore(item) {
  return Math.max(item.gi_response || 0, item.physical_response || 0, item.subjective_feel || 0);
}

function getDateRange(rangePreset, customRange) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);

  if (rangePreset === 'This Week') {
    const day = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - day);
    return { start, end: null };
  }

  if (rangePreset === 'Last 30D') {
    start.setDate(today.getDate() - 29);
    return { start, end: null };
  }

  if (rangePreset === 'Last 90D') {
    start.setDate(today.getDate() - 89);
    return { start, end: null };
  }

  if (rangePreset === 'Custom') {
    return {
      start: customRange.start ? new Date(`${customRange.start}T00:00:00`) : null,
      end: customRange.end ? new Date(`${customRange.end}T23:59:59`) : null,
    };
  }

  return { start: null, end: null };
}

function getBadgeClass(category, categories) {
  const index = categories.indexOf(category);
  return categoryBadgeClasses[index % categoryBadgeClasses.length];
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfCalendarGrid(monthDate) {
  const monthStart = getMonthStart(monthDate);
  const day = (monthStart.getDay() + 6) % 7;
  monthStart.setDate(monthStart.getDate() - day);
  return monthStart;
}

function buildCalendarDays(monthDate) {
  const firstCell = startOfCalendarGrid(monthDate);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell);
    day.setDate(firstCell.getDate() + index);
    return day;
  });
}

function DetailDrawer({ entry, dayEntries, categories, onClose, onDelete }) {
  if (!entry && !dayEntries?.length) return null;

  const visibleEntries = dayEntries?.length ? dayEntries : [entry];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-sm">
      <button type="button" aria-label="Close details" className="flex-1" onClick={onClose} />
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-[0_40px_120px_rgba(19,24,22,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">
              {dayEntries?.length ? `${visibleEntries.length} entries` : 'Intervention detail'}
            </p>
            <h2 className="font-display mt-3 text-3xl text-ink">
              {dayEntries?.length ? formatDate(visibleEntries[0]?.date) : entry.intervention_type}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-ink/10 px-3 py-2 text-sm font-semibold text-ink">
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {visibleEntries.map((item) => (
            <section key={item.id} className="rounded-[26px] border border-ink/10 bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClass(item.intervention_type, categories)}`}>
                    {item.intervention_type}
                  </span>
                  <p className="mt-3 text-sm text-ink/65">{formatDate(item.date)}</p>
                  <p className="mt-2 text-base font-semibold text-ink">{buildProtocolSummary(item.intervention_type, item.protocol_payload)}</p>
                  <p className="mt-2 text-sm text-ink/70">{item.races?.name || item.target_race || 'No linked race'}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/interventions/${item.id}`} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                    Edit
                  </a>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">GI</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{item.gi_response ?? '-'}</p>
                </div>
                <div className="rounded-[18px] bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">Physical</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{item.physical_response ?? '-'}</p>
                </div>
                <div className="rounded-[18px] bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">Feel</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{item.subjective_feel ?? '-'}</p>
                </div>
              </div>

              <dl className="mt-4 space-y-3 text-sm text-ink/75">
                <div>
                  <dt className="font-semibold text-ink">Training Phase</dt>
                  <dd>{item.training_phase || 'Not set'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Race Summary</dt>
                  <dd>{formatRaceSummary(item.races)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Details</dt>
                  <dd>{item.details || 'No additional context'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Notes</dt>
                  <dd>{item.notes || 'No notes'}</dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[30px] border border-ink/10 bg-white p-10 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-paper">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 4h6m-7 4h8m-9 4h10m-2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v10a2 2 0 0 1-2 2Z" />
        </svg>
      </div>
      <h2 className="font-display mt-6 text-4xl text-ink">No interventions logged yet.</h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ink/72">
        Every heat session, gut training run, and bicarb trial you log becomes data. Start building your N=1 dataset.
      </p>
      <a href="/log-intervention" className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper">
        Log Your First Intervention
      </a>
    </div>
  );
}

export default function History() {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [datePreset, setDatePreset] = useState('Last 30D');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [linkedRace, setLinkedRace] = useState('');
  const [minimumOutcome, setMinimumOutcome] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [selectedRows, setSelectedRows] = useState([]);
  const [drawerEntry, setDrawerEntry] = useState(null);
  const [drawerDayEntries, setDrawerDayEntries] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const navLinks = [
    { href: '/dashboard', label: 'Home', description: 'Insights, trends, and recent training.' },
    { href: '/guide', label: 'Guide', description: 'Learn how history fits into Threshold.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/settings', label: 'Settings', description: 'Edit baselines and zones.' },
    { href: '/content', label: 'Research', description: 'Browse the research library.' },
    { href: '/', label: 'Landing Page', description: 'Return to the public entry page.' },
  ];

  useEffect(() => {
    async function fetchInterventions() {
      try {
        const res = await fetch('/api/interventions');
        if (res.ok) {
          const data = await res.json();
          setInterventions(data.interventions || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchInterventions();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(interventions.map((item) => item.intervention_type).filter(Boolean))),
    [interventions]
  );

  const races = useMemo(
    () =>
      Array.from(
        new Map(
          interventions
            .filter((item) => item.races?.id || item.target_race)
            .map((item) => [
              item.races?.id || item.target_race,
              {
                id: item.races?.id || item.target_race,
                name: item.races?.name || item.target_race,
              },
            ])
        ).values()
      ),
    [interventions]
  );

  const filteredInterventions = useMemo(() => {
    const { start, end } = getDateRange(datePreset, customRange);

    return interventions.filter((item) => {
      if (selectedCategories.length && !selectedCategories.includes(item.intervention_type)) return false;
      if (linkedRace && (item.races?.id || item.target_race) !== linkedRace) return false;
      if (getOutcomeScore(item) < minimumOutcome) return false;

      if (start || end) {
        if (!item.date) return false;
        const itemDate = new Date(`${item.date}T00:00:00`);
        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
      }

      return true;
    });
  }, [customRange, datePreset, interventions, linkedRace, minimumOutcome, selectedCategories]);

  const sortedInterventions = useMemo(() => {
    const items = [...filteredInterventions];
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    items.sort((a, b) => {
      let left = '';
      let right = '';

      switch (sortConfig.key) {
        case 'date':
          left = a.date || '';
          right = b.date || '';
          break;
        case 'category':
          left = a.intervention_type || '';
          right = b.intervention_type || '';
          break;
        case 'race':
          left = a.races?.name || a.target_race || '';
          right = b.races?.name || b.target_race || '';
          break;
        case 'outcome':
          left = getOutcomeScore(a);
          right = getOutcomeScore(b);
          break;
        default:
          left = a[sortConfig.key] || '';
          right = b[sortConfig.key] || '';
      }

      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return 0;
    });

    return items;
  }, [filteredInterventions, sortConfig]);

  const entriesByDate = useMemo(() => {
    return sortedInterventions.reduce((map, item) => {
      if (!item.date) return map;
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
      return map;
    }, {});
  }, [sortedInterventions]);

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  // Block summary stats (all-time, computed from full intervention list)
  const blockSummary = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Category counts — all time
    const allTimeCounts = {};
    // Category counts — last 30 days
    const last30Counts = {};
    // Weekly counts for sparkline (last 12 weeks)
    const weeklyCounts = Array.from({ length: 12 }, () => 0);

    interventions.forEach((item) => {
      const type = item.intervention_type || 'Other';
      allTimeCounts[type] = (allTimeCounts[type] || 0) + 1;

      if (item.date) {
        const d = new Date(`${item.date}T00:00:00`);
        if (d >= thirtyDaysAgo) {
          last30Counts[type] = (last30Counts[type] || 0) + 1;
        }

        // Compute which of the last 12 weeks this falls in
        const weeksAgo = Math.floor((now - d) / (7 * 24 * 60 * 60 * 1000));
        if (weeksAgo >= 0 && weeksAgo < 12) {
          weeklyCounts[11 - weeksAgo] += 1;
        }
      }
    });

    // Sort categories by all-time count
    const topCategories = Object.entries(allTimeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Current streak in consecutive weeks with ≥1 log
    let streak = 0;
    for (let i = 11; i >= 0; i--) {
      if (weeklyCounts[i] > 0) streak++;
      else break;
    }

    return { allTimeCounts, last30Counts, weeklyCounts, topCategories, streak };
  }, [interventions]);

  function toggleCategory(category) {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category]
    );
  }

  function requestSort(key) {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'date' ? 'desc' : 'asc' };
    });
  }

  function toggleRow(id) {
    setSelectedRows((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function handleDelete(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    const confirmed = window.confirm(list.length > 1 ? `Delete ${list.length} selected interventions?` : 'Delete this intervention?');
    if (!confirmed) return;

    await Promise.all(
      list.map((id) =>
        fetch(`/api/interventions?id=${id}`, {
          method: 'DELETE',
        })
      )
    );

    setInterventions((current) => current.filter((item) => !list.includes(item.id)));
    setSelectedRows((current) => current.filter((id) => !list.includes(id)));
    setDrawerEntry(null);
    setDrawerDayEntries([]);
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold History</p>
          </div>
          <NavMenu
            label="History navigation"
            links={navLinks}
            primaryLink={{ href: '/log-intervention', label: 'Log Intervention' }}
          />
        </div>

        <DashboardTabs activeHref="/history" />

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Intervention Dataset</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Intervention History
              </h1>
            </div>
            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Dataset</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">Total</p>
                  <p className="mt-1.5 text-2xl font-semibold">{interventions.length}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">Last 30d</p>
                  <p className="mt-1.5 text-2xl font-semibold">
                    {Object.values(blockSummary.last30Counts).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">Streak</p>
                  <p className="mt-1.5 text-2xl font-semibold">{blockSummary.streak}w</p>
                </div>
              </div>

              {/* Weekly sparkline — last 12 weeks */}
              {interventions.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/40">Weekly volume (12 weeks)</p>
                  <div className="flex items-end gap-1 h-10">
                    {blockSummary.weeklyCounts.map((count, i) => {
                      const maxCount = Math.max(...blockSummary.weeklyCounts, 1);
                      const heightPct = Math.max(8, Math.round((count / maxCount) * 100));
                      const isLast = i === 11;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-sm transition-all ${isLast ? 'bg-accent' : 'bg-white/20'}`}
                          style={{ height: `${heightPct}%` }}
                          title={`${count} session${count !== 1 ? 's' : ''}`}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-1 text-right text-[10px] text-white/30">this week →</p>
                </div>
              )}

              {/* Top categories */}
              {blockSummary.topCategories.length > 0 && (
                <div className="mt-4 space-y-2">
                  {blockSummary.topCategories.slice(0, 3).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="truncate text-xs text-white/60">{type}</span>
                      <span className="ml-2 shrink-0 font-mono text-xs font-semibold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {interventions.length === 0 ? <EmptyState /> : (
          <>
            <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-accent">View</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Log Explorer</h2>
                </div>
                <div className="inline-flex rounded-full border border-ink/10 bg-paper p-1">
                  {['table', 'calendar'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setView(option)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                        view === option ? 'bg-panel text-paper' : 'text-ink'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                          selectedCategories.includes(category) ? 'bg-panel text-paper' : `${getBadgeClass(category, categories)}`
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Date Range</p>
                  <div className="flex flex-wrap gap-2">
                    {dateRangePresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDatePreset(preset)}
                        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                          datePreset === preset ? 'bg-panel text-paper' : 'border border-ink/10 bg-paper text-ink'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  {datePreset === 'Custom' ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        value={customRange.start}
                        onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))}
                        className="rounded-2xl border border-ink/10 bg-paper px-3 py-2 text-sm"
                      />
                      <input
                        type="date"
                        value={customRange.end}
                        onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))}
                        className="rounded-2xl border border-ink/10 bg-paper px-3 py-2 text-sm"
                      />
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-ink">Linked Race</label>
                  <select
                    value={linkedRace}
                    onChange={(event) => setLinkedRace(event.target.value)}
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink"
                  >
                    <option value="">All races</option>
                    {races.map((race) => (
                      <option key={race.id} value={race.id}>
                        {race.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-ink">Minimum Outcome Rating</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={minimumOutcome}
                    onChange={(event) => setMinimumOutcome(Number(event.target.value))}
                    className="w-full accent-[var(--color-accent)]"
                  />
                  <p className="mt-2 text-sm text-ink/65">{minimumOutcome} or higher</p>
                </div>
              </div>

              {selectedRows.length ? (
                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedRows)}
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                  >
                    Delete Selected
                  </button>
                  <p className="text-sm text-ink/65">{selectedRows.length} selected</p>
                </div>
              ) : null}
            </section>

            {view === 'table' ? (
              <section className="mt-6 overflow-hidden rounded-[30px] border border-ink/10 bg-white shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-paper">
                      <tr className="text-left text-xs uppercase tracking-[0.18em] text-ink/55">
                        <th className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedRows.length > 0 && selectedRows.length === sortedInterventions.length}
                            onChange={(event) => setSelectedRows(event.target.checked ? sortedInterventions.map((item) => item.id) : [])}
                          />
                        </th>
                        {[
                          ['date', 'Date'],
                          ['category', 'Category'],
                          ['race', 'Linked Race'],
                          ['outcome', 'Outcome'],
                        ].map(([key, label]) => (
                          <th key={key} className="px-4 py-4">
                            <button type="button" onClick={() => requestSort(key)} className="font-semibold text-ink">
                              {label}
                            </button>
                          </th>
                        ))}
                        <th className="px-4 py-4">Protocol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedInterventions.map((item) => (
                        <tr key={item.id} className="border-t border-ink/8 hover:bg-paper/60">
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedRows.includes(item.id)}
                              onChange={() => toggleRow(item.id)}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </td>
                          <td className="px-4 py-4 text-sm text-ink">{formatDate(item.date)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClass(item.intervention_type, categories)}`}>
                              {item.intervention_type}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-ink/72">{item.races?.name || item.target_race || 'No race'}</td>
                          <td className="px-4 py-4 text-sm font-semibold text-ink">{getOutcomeScore(item) || '-'}</td>
                          <td className="px-4 py-4 text-sm text-ink/72">
                            <button type="button" onClick={() => { setDrawerEntry(item); setDrawerDayEntries([]); }} className="text-left">
                              {buildProtocolSummary(item.intervention_type, item.protocol_payload)}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="mt-6 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                    className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Prev
                  </button>
                  <h2 className="font-display text-3xl text-ink">
                    {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                    className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Next
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.18em] text-ink/45">
                  {calendarWeekdays.map((day) => (
                    <div key={day} className="py-2">{day}</div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const key = day.toISOString().slice(0, 10);
                    const items = entriesByDate[key] || [];
                    const inMonth = day.getMonth() === calendarMonth.getMonth();
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (!items.length) return;
                          setDrawerEntry(null);
                          setDrawerDayEntries(items);
                        }}
                        className={`min-h-[112px] rounded-[22px] border p-3 text-left transition ${
                          items.length ? 'border-ink/10 bg-paper hover:bg-[#efe7dc]' : 'border-ink/6 bg-white'
                        } ${inMonth ? 'text-ink' : 'text-ink/30'}`}
                      >
                        <p className="text-sm font-semibold">{day.getDate()}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {items.slice(0, 3).map((item) => (
                            <span key={item.id} className={`h-2.5 w-2.5 rounded-full ${getBadgeClass(item.intervention_type, categories)}`} />
                          ))}
                        </div>
                        {items.length > 3 ? <p className="mt-2 text-xs text-ink/55">+{items.length - 3} more</p> : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink/45">
                  <span>Less</span>
                  {categoryBadgeClasses.map((tone) => (
                    <span key={tone} className={`h-3 w-6 rounded-full ${tone.split(' ')[0]}`} />
                  ))}
                  <span>More</span>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <DetailDrawer
        entry={drawerEntry}
        dayEntries={drawerDayEntries}
        categories={categories}
        onClose={() => {
          setDrawerEntry(null);
          setDrawerDayEntries([]);
        }}
        onDelete={handleDelete}
      />
    </main>
  );
}
