import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getCoachDashboardData } from '../../lib/coachDashboard';

function metricToneClasses(tone) {
  if (tone === 'green') return 'text-emerald-300';
  if (tone === 'amber') return 'text-amber-300';
  if (tone === 'red') return 'text-red-300';
  return 'text-white';
}

function statusDotClasses(status) {
  if (status === 'green') return 'bg-emerald-500';
  if (status === 'red') return 'bg-red-500';
  return 'bg-amber-400';
}

function alertLabel(level) {
  if (level === 'red') return 'Red flag';
  if (level === 'amber') return 'Amber flag';
  if (level === 'blue') return 'Race alert';
  return 'Completed';
}

function formatMetricValue(metric, suffix = '') {
  return `${metric?.value ?? 0}${suffix}`;
}

function DashboardSkeleton() {
  return (
    <main className="ui-shell text-ink">
      <section className="ui-card-dark">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="ui-skeleton h-3 w-24 rounded-full" />
              <div className="ui-skeleton mt-4 h-10 w-24 rounded-full" />
              <div className="ui-skeleton mt-4 h-3 w-32 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="ui-card">
          <div className="ui-skeleton h-5 w-32 rounded-full" />
          <div className="mt-5 space-y-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="rounded-[20px] border border-border-subtle bg-surface-light p-4">
                <div className="ui-skeleton h-4 w-40 rounded-full" />
                <div className="ui-skeleton mt-3 h-3 w-52 rounded-full" />
                <div className="ui-skeleton mt-4 h-3 w-28 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-skeleton h-5 w-32 rounded-full" />
          <div className="ui-skeleton mt-5 h-11 w-full rounded-2xl" />
          <div className="ui-skeleton mt-3 h-11 w-full rounded-2xl" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-[18px] border border-border-subtle bg-surface-light p-3">
                <div className="ui-skeleton h-10 w-10 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="ui-skeleton h-3 w-28 rounded-full" />
                  <div className="ui-skeleton mt-2 h-3 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 ui-card-dark">
        <div className="ui-skeleton h-5 w-40 rounded-full" />
        <div className="ui-skeleton mt-8 h-24 w-full rounded-[24px]" />
      </section>
    </main>
  );
}

function MetricCard({ label, metric, suffix = '', detail, highlight = false }) {
  return (
    <article className={`rounded-[24px] border p-5 ${highlight ? 'border-amber-300/40 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/58">{label}</p>
      <p className={`mt-4 text-4xl font-semibold ui-data ${metricToneClasses(metric?.tone)}`}>
        {formatMetricValue(metric, suffix)}
      </p>
      <p className="mt-3 text-sm text-white/62">{detail || metric?.detail || ''}</p>
    </article>
  );
}

function AlertFeed({ alerts }) {
  if (!alerts.length) {
    return (
      <div className="rounded-[28px] border border-border-subtle bg-surface-light px-6 py-12 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M5 12.5 9.2 17 19 7.5M12 3.5c4.7 0 8.5 3.8 8.5 8.5s-3.8 8.5-8.5 8.5S3.5 16.7 3.5 12 7.3 3.5 12 3.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-display mt-6 text-3xl text-ink">All athletes on track</h2>
        <p className="mt-3 text-sm leading-7 text-ink/62">Nice work.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[680px] space-y-4 overflow-y-auto pr-1">
      {alerts.map((alert) => (
        <Link
          key={alert.id}
          href={alert.href}
          className={`block rounded-[24px] border-l-4 border border-border-subtle bg-white p-5 shadow-warm transition hover:-translate-y-[1px] hover:shadow-warm-lg ${alert.borderClassName}`}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-light text-sm font-semibold text-ink">
              {alert.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink">{alert.athleteName}</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${alert.badgeClassName}`}>
                  {alertLabel(alert.level)}
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-ink">{alert.title}</p>
              <p className="mt-2 text-sm leading-6 text-ink/62">{alert.body}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.16em] text-ink/42">{alert.timestampLabel}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RosterFilters({
  searchValue,
  onSearchChange,
  groupFilter,
  onGroupFilterChange,
  statusFilter,
  onStatusFilterChange,
  groups,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Athlete roster</p>
          <p className="mt-1 text-sm text-ink/58">Search by athlete, group, or status.</p>
        </div>
        <Link href="/coach/setup?step=3" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white">
          <span className="text-base leading-none">+</span>
          <span>Invite Athlete</span>
        </Link>
      </div>

      <input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search athletes"
        className="ui-input"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <select value={groupFilter} onChange={(event) => onGroupFilterChange(event.target.value)} className="ui-input">
          <option value="all">All groups</option>
          {groups.map((groupName) => (
            <option key={groupName} value={groupName}>
              {groupName}
            </option>
          ))}
        </select>

        <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="ui-input">
          <option value="all">All statuses</option>
          <option value="green">Green</option>
          <option value="amber">Amber</option>
          <option value="red">Red</option>
        </select>
      </div>
    </div>
  );
}

function RosterList({ roster, collapsed, onToggleCollapsed }) {
  return (
    <div className="rounded-[28px] border border-border-subtle bg-white p-5 shadow-warm">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Roster</p>
        <button type="button" onClick={onToggleCollapsed} className="rounded-full border border-border px-4 py-2 text-sm text-ink/70">
          {collapsed ? 'Show roster' : 'Hide roster'}
        </button>
      </div>

      <div className={`${collapsed ? 'hidden' : 'block'} md:block`}>
        <div className="mt-4 space-y-1 md:mt-0">
          {roster.length ? roster.map((athlete) => (
            <Link
              key={athlete.athleteId}
              href={athlete.href}
              className="flex items-center gap-3 rounded-[18px] px-2 py-3 transition hover:bg-surface-light"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-light text-sm font-semibold text-ink">
                {athlete.initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{athlete.athleteName}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${athlete.groupClassName}`}>
                    {athlete.groupName}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink/58">Last active {athlete.lastActiveLabel}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusDotClasses(athlete.status)}`} />
                <span className="text-xs uppercase tracking-[0.16em] text-ink/40">{athlete.status}</span>
              </div>
            </Link>
          )) : (
            <div className="rounded-[18px] bg-surface-light px-4 py-5 text-sm text-ink/58">
              No athletes match the current filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RaceTimeline({ races }) {
  return (
    <section className="mt-6 ui-card-dark overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Upcoming races</p>
          <p className="mt-1 text-sm text-white/62">A horizontal view of the next race moments across your roster.</p>
        </div>
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">{races.length} scheduled</p>
      </div>

      {races.length ? (
        <div className="mt-8 overflow-x-auto pb-2">
          <div className="min-w-[860px]">
            <div className="relative h-28 rounded-[28px] border border-white/10 bg-white/5 px-6">
              <div className="absolute left-6 right-6 top-1/2 h-px bg-white/16" />
              {races.map((race) => (
                <Link
                  key={race.id}
                  href={race.href}
                  className="absolute top-1/2 block -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${race.position}%` }}
                >
                  <span className="mx-auto block h-4 w-4 rounded-full border-4 border-amber-300 bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.05)]" />
                  <div className="mt-5 w-40 rounded-[18px] border border-white/10 bg-white/6 p-3 text-left shadow-panel">
                    <p className="truncate text-sm font-semibold text-white">{race.raceName}</p>
                    <p className="mt-1 truncate text-xs uppercase tracking-[0.14em] text-amber-200">{race.athleteName}</p>
                    <p className="mt-2 text-xs text-white/64">{race.dateLabel}</p>
                    <p className="mt-1 text-xs text-white/48">
                      {race.daysUntilRace === 0 ? 'Race day' : `${race.daysUntilRace} days until race`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 px-5 py-8 text-sm text-white/62">
          No upcoming races are on the calendar yet.
        </div>
      )}
    </section>
  );
}

export default function CoachDashboardPage({ initialDashboard }) {
  const [dashboard, setDashboard] = useState(initialDashboard || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rosterCollapsed, setRosterCollapsed] = useState(true);

  useEffect(() => {
    if (!initialDashboard) {
      setRosterCollapsed(false);
    }
  }, [initialDashboard]);

  useEffect(() => {
    let mounted = true;

    async function refreshDashboard({ silent = false } = {}) {
      if (!silent) {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch('/api/coach/dashboard');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Could not refresh dashboard.');
        }

        if (mounted) {
          setDashboard(data);
          setLoadError('');
        }
      } catch (error) {
        if (mounted) {
          setLoadError(error.message);
        }
      } finally {
        if (mounted && !silent) {
          setIsRefreshing(false);
        }
      }
    }

    const intervalId = window.setInterval(() => {
      refreshDashboard({ silent: true });
    }, 30000);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshDashboard({ silent: true });
      }
    }

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const groups = useMemo(() => {
    const names = new Set((dashboard?.roster || []).map((item) => item.groupName).filter(Boolean));
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [dashboard]);

  const filteredRoster = useMemo(() => {
    return (dashboard?.roster || []).filter((athlete) => {
      const matchesSearch =
        !searchValue ||
        athlete.athleteName.toLowerCase().includes(searchValue.toLowerCase()) ||
        athlete.groupName.toLowerCase().includes(searchValue.toLowerCase()) ||
        athlete.status.toLowerCase().includes(searchValue.toLowerCase());

      const matchesGroup = groupFilter === 'all' || athlete.groupName === groupFilter;
      const matchesStatus = statusFilter === 'all' || athlete.status === statusFilter;

      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [dashboard, groupFilter, searchValue, statusFilter]);

  if (!dashboard) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="ui-shell text-ink">
      <section className="ui-card-dark">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Coach dashboard</p>
            <h1 className="font-display mt-4 text-4xl text-white md:text-5xl">Morning command center</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">
              Problems surface first, races stay visible, and compliance is readable without opening tabs.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">
              {isRefreshing ? 'Refreshing now' : 'Live refresh every 30s'}
            </p>
            <p className="mt-2 text-sm text-white/58">
              Coach code <span className="ui-data text-white">{dashboard.profile?.coach_code || '—'}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total athletes"
            metric={dashboard.metrics.totalAthletes}
            detail={dashboard.metrics.totalAthletes.detail}
          />
          <MetricCard
            label="Active protocols"
            metric={dashboard.metrics.activeProtocols}
            detail="Assigned or currently in progress"
          />
          <MetricCard
            label="Avg protocol compliance"
            metric={dashboard.metrics.avgProtocolCompliance}
            suffix="%"
            detail="Green above 80, amber from 60 to 80, red below 60"
          />
          <MetricCard
            label="Athletes needing attention"
            metric={dashboard.metrics.athletesNeedingAttention}
            detail={dashboard.metrics.athletesNeedingAttention.value > 0 ? 'Attention items are waiting in the feed' : 'No athletes currently need intervention'}
            highlight={dashboard.metrics.athletesNeedingAttention.value > 0}
          />
        </div>
      </section>

      {loadError ? (
        <div className="mt-4 rounded-[18px] border border-amber-300/40 bg-amber-100/70 px-4 py-3 text-sm text-amber-900">
          Dashboard refresh paused: {loadError}
        </div>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Attention feed</p>
              <p className="mt-1 text-sm text-ink/58">Ordered by priority so the biggest risks are always first.</p>
            </div>
            <p className="text-xs uppercase tracking-[0.16em] text-ink/40">{dashboard.alerts.length} alerts</p>
          </div>

          <AlertFeed alerts={dashboard.alerts} />
        </div>

        <div className="space-y-4">
          <RosterFilters
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            groups={groups}
          />

          <RosterList
            roster={filteredRoster}
            collapsed={rosterCollapsed}
            onToggleCollapsed={() => setRosterCollapsed((value) => !value)}
          />
        </div>
      </section>

      <RaceTimeline races={dashboard.races} />
    </main>
  );
}

export async function getServerSideProps(context) {
  try {
    const dashboard = await getCoachDashboardData({ req: context.req });

    if (!dashboard.authenticated) {
      return {
        redirect: {
          destination: '/login?next=/coach/dashboard',
          permanent: false,
        },
      };
    }

    return {
      props: {
        initialDashboard: dashboard,
      },
    };
  } catch (error) {
    console.error('[coach dashboard page] failed:', error);
    return {
      props: {
        initialDashboard: null,
      },
    };
  }
}
