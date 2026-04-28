import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';
import { getAdminRequestContext } from '../lib/authServer';

function formatShortDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatPercent(part, total) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function timeAgo(value) {
  if (!value) return '—';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function ActivityDot({ lastDate }) {
  if (!lastDate) {
    return <span title="No logs yet" className="h-2.5 w-2.5 rounded-full bg-ink/12" />;
  }

  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return <span title="Active this week" className="h-2.5 w-2.5 rounded-full bg-emerald-500" />;
  if (days <= 21) return <span title="Slowing down" className="h-2.5 w-2.5 rounded-full bg-amber-400" />;
  return <span title="Inactive 21+ days" className="h-2.5 w-2.5 rounded-full bg-red-400" />;
}

function typeIcon(type) {
  const map = {
    'Heat Acclimation': 'HA',
    Altitude: 'AL',
    Sleep: 'SL',
    'Cold Exposure': 'CE',
    'Gut Training': 'GT',
    'Sodium Bicarbonate': 'SB',
    'Carbohydrate Loading': 'CL',
    'Strength Training': 'ST',
    HRV: 'HR',
    Sauna: 'SA',
    'Workout Check-in': 'WC',
  };

  return map[type] || 'LG';
}

function getLogTime(log) {
  return log?.logged_at || log?.inserted_at || null;
}

function StatCard({ label, value, detail, tone = 'default' }) {
  const toneClassName = {
    default: 'text-ink',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    accent: 'text-accent',
  }[tone] || 'text-ink';

  return (
    <div className="rounded-[24px] border border-ink/10 bg-white px-4 py-4 shadow-sm">
      <p className={`text-2xl font-semibold ${toneClassName}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/35">{label}</p>
      {detail ? <p className="mt-2 text-sm text-ink/55">{detail}</p> : null}
    </div>
  );
}

function AlertCard({ alert }) {
  const toneClasses = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    critical: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${toneClasses[alert.tone] || toneClasses.warning}`}>
      <p className="text-sm font-semibold">{alert.title}</p>
      <p className="mt-1 text-sm opacity-80">{alert.detail}</p>
    </div>
  );
}

export default function AdminPage() {
  const [overview, setOverview] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedAthlete, setExpandedAthlete] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNotes, setInviteNotes] = useState('');
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [overviewRes, rosterRes, logsRes] = await Promise.all([
          fetch('/api/admin/overview'),
          fetch('/api/admin/athletes'),
          fetch('/api/admin/recent-logs?limit=40'),
        ]);

        if ([overviewRes, rosterRes, logsRes].some((response) => response.status === 401)) {
          window.location.href = '/login?next=/admin';
          return;
        }

        if ([overviewRes, rosterRes, logsRes].some((response) => response.status === 403)) {
          window.location.href = '/dashboard';
          return;
        }

        const [overviewData, rosterData, logsData] = await Promise.all([
          overviewRes.json(),
          rosterRes.json(),
          logsRes.json(),
        ]);

        if (!overviewRes.ok) {
          setError(overviewData.error || 'Could not load admin overview.');
          return;
        }

        if (!rosterRes.ok) {
          setError(rosterData.error || 'Could not load athlete roster.');
          return;
        }

        if (!logsRes.ok) {
          setError(logsData.error || 'Could not load recent activity.');
          return;
        }

        setOverview(overviewData);
        setAthletes(rosterData.athletes || []);
        setLogs(logsData.logs || []);
      } catch (_) {
        setError('Network error while loading admin data.');
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  const totalInterventions = useMemo(
    () => athletes.reduce((sum, athlete) => sum + (athlete.intervention_count || 0), 0),
    [athletes]
  );
  const activeThisWeek = useMemo(
    () =>
      athletes.filter((athlete) => {
        if (!athlete.last_intervention_at) return false;
        return Date.now() - new Date(athlete.last_intervention_at).getTime() < 7 * 24 * 60 * 60 * 1000;
      }).length,
    [athletes]
  );
  const onboarded = useMemo(
    () => athletes.filter((athlete) => athlete.onboarding_complete).length,
    [athletes]
  );

  async function createInvite(event) {
    event.preventDefault();
    setInviteCreating(true);
    setInviteError('');
    setInviteLink('');
    setInviteCopied(false);

    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim() || null,
          notes: inviteNotes.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setInviteError(data.error || 'Could not create invite.');
        return;
      }

      setInviteLink(data.joinUrl);
      setInviteEmail('');
      setInviteNotes('');
      setOverview((current) => {
        if (!current) return current;
        return {
          ...current,
          metrics: {
            ...current.metrics,
            pendingInvites: (current.metrics.pendingInvites || 0) + 1,
          },
          recentInvites: [data.invite, ...(current.recentInvites || [])].slice(0, 20),
        };
      });
    } catch (_) {
      setInviteError('Network error while creating invite.');
    } finally {
      setInviteCreating(false);
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (_) {}
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'roster', label: `Roster (${athletes.length})` },
    { key: 'activity', label: `Activity (${logs.length})` },
    { key: 'invite', label: 'Invite' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">A</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Admin Console</p>
              <p className="text-sm text-ink/55">
                {overview?.operator?.email || 'Threshold operator account'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-xs font-semibold text-ink transition hover:bg-ink hover:text-paper"
            >
              Athlete view
            </a>
            <NavMenu />
          </div>
        </div>

        <section className="mb-6 overflow-hidden rounded-[34px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#efe7dc_42%,#d8c0a3_100%)] px-6 py-7 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">Private Operator Surface</p>
              <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">
                Monitor growth, usage, onboarding, and admin workflows in one place.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
                This page lives at <span className="font-semibold text-ink">/admin</span> because it is an operator-only control surface, not a normal athlete page. Access is now tied to an authenticated admin account, and the dashboard is built around metrics that are actually useful for running the product.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/50 bg-white/55 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">At a glance</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Athletes"
                  value={loading ? '—' : overview?.metrics?.totalAthletes ?? athletes.length}
                  detail={loading ? 'Loading' : `${overview?.metrics?.newAthletes30d ?? 0} joined in the last 30 days`}
                />
                <StatCard
                  label="Active 7d"
                  value={loading ? '—' : overview?.metrics?.activeAthletes7d ?? activeThisWeek}
                  detail={loading ? 'Loading' : `${overview?.metrics?.interventionCount7d ?? 0} logs in the last week`}
                  tone="success"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="mb-5 inline-flex flex-wrap rounded-full border border-ink/10 bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.key ? 'bg-ink text-paper shadow-sm' : 'text-ink/55 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total athletes"
                value={loading ? '—' : overview?.metrics?.totalAthletes ?? athletes.length}
                detail={loading ? 'Loading' : `${overview?.metrics?.newAthletes7d ?? 0} joined in the last 7 days`}
              />
              <StatCard
                label="Onboarded"
                value={loading ? '—' : overview?.metrics?.onboardedCount ?? onboarded}
                detail={
                  loading
                    ? 'Loading'
                    : `${formatPercent(
                        overview?.metrics?.onboardedCount ?? onboarded,
                        overview?.metrics?.totalAthletes ?? athletes.length
                      )} completion rate`
                }
                tone="success"
              />
              <StatCard
                label="Paid accounts"
                value={loading ? '—' : overview?.metrics?.paidCount ?? 0}
                detail={loading ? 'Loading' : 'Active, trialing, or past_due subscriptions'}
                tone="accent"
              />
              <StatCard
                label="Pending invites"
                value={loading ? '—' : overview?.metrics?.pendingInvites ?? 0}
                detail={loading ? 'Loading' : `${overview?.metrics?.inviteConversionRate ?? 0}% recent conversion`}
                tone="warning"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Strava linked"
                value={loading ? '—' : overview?.metrics?.connectedStravaAccounts ?? 0}
                detail={loading ? 'Loading' : 'Athlete accounts connected to Strava'}
              />
              <StatCard
                label="Activity sync 30d"
                value={loading ? '—' : overview?.metrics?.stravaActivities30d ?? 0}
                detail={loading ? 'Loading' : `${overview?.metrics?.syncedAthletes30d ?? 0} athlete accounts contributed activity`}
                tone="accent"
              />
              <StatCard
                label="Total synced activities"
                value={loading ? '—' : overview?.metrics?.totalStravaActivities ?? 0}
                detail={loading ? 'Loading' : 'Cached Strava activity records'}
              />
              <StatCard
                label="Research library"
                value={loading ? '—' : overview?.metrics?.publishedResearchCount ?? 0}
                detail={loading ? 'Loading' : 'Published research entries'}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Operator Health</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink">What needs attention</h2>
                  </div>
                  <p className="text-xs text-ink/40">Updated {timeAgo(overview?.generatedAt)}</p>
                </div>

                <div className="mt-5 space-y-3">
                  {loading
                    ? <p className="text-sm text-ink/50">Loading alerts...</p>
                    : (overview?.alerts || []).map((alert) => <AlertCard key={alert.id} alert={alert} />)}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <StatCard
                    label="Logs 7d"
                    value={loading ? '—' : overview?.metrics?.interventionCount7d ?? 0}
                    detail="Latest weekly volume"
                  />
                  <StatCard
                    label="Logs 30d"
                    value={loading ? '—' : overview?.metrics?.interventionCount30d ?? 0}
                    detail="Rolling monthly volume"
                  />
                  <StatCard
                    label="Coach links"
                    value={loading ? '—' : overview?.metrics?.activeCoachLinks ?? 0}
                    detail={loading ? 'Loading' : `${overview?.metrics?.coachCount ?? 0} coach profiles`}
                  />
                </div>
              </section>

              <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Plan Mix</p>
                <h2 className="mt-2 text-xl font-semibold text-ink">Who is on what tier</h2>

                <div className="mt-5 space-y-4">
                  {(overview?.planBreakdown || []).map((tier) => {
                    const total = overview?.metrics?.totalAthletes || 0;
                    const width = total ? `${Math.max(6, Math.round((tier.count / total) * 100))}%` : '6%';

                    return (
                      <div key={tier.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-semibold text-ink">{tier.label}</span>
                          <span className="text-ink/45">{tier.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-paper">
                          <div className="h-2 rounded-full bg-ink" style={{ width }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-[24px] bg-paper p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Quick actions</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href="/invite" className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink">
                      Open invite list
                    </a>
                    <a href="/content/admin" className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink">
                      Research admin
                    </a>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Preview Mode</p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Open the real UI with seeded fake data</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
                    Use this to review major product surfaces without needing real coach relationships, athlete accounts, or live activity data.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="/coach-command-center?preview=coach-demo"
                    className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
                  >
                    Preview Coach Command Center
                  </a>
                  <a
                    href="/dashboard?preview=athlete-demo"
                    className="rounded-full border border-ink/10 bg-paper px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Preview Athlete Dashboard
                  </a>
                  <a
                    href="/onboarding?preview=onboarding-demo"
                    className="rounded-full border border-ink/10 bg-paper px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Preview Onboarding
                  </a>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] bg-paper px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Scenario</p>
                  <p className="mt-2 text-sm font-semibold text-ink">Coach Demo Roster</p>
                  <p className="mt-2 text-sm text-ink/60">5 athletes, mixed urgency, active protocols, notes, invites, and templates.</p>
                </div>
                <div className="rounded-[22px] bg-paper px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Athlete Demo</p>
                  <p className="mt-2 text-sm text-ink/60">Preview a realistic dashboard with race context, protocols, activity load, unread coach messages, and insight cards.</p>
                </div>
                <div className="rounded-[22px] bg-paper px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Onboarding Demo</p>
                  <p className="mt-2 text-sm text-ink/60">Walk through the race picker, sport setup, and a simulated Strava connection without touching live onboarding data.</p>
                </div>
              </div>
            </section>
            
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Recent Signups</p>
                <div className="mt-4 space-y-3">
                  {loading ? (
                    <p className="text-sm text-ink/50">Loading signups...</p>
                  ) : (
                    (overview?.recentSignups || []).map((athlete) => (
                      <div key={athlete.id} className="flex items-center justify-between rounded-[18px] bg-paper px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{athlete.name}</p>
                          <p className="text-xs text-ink/45">{athlete.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/40">
                            {athlete.subscription_tier}
                          </p>
                          <p className="text-xs text-ink/45">{formatShortDate(athlete.created_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Most Common Logs</p>
                <div className="mt-4 space-y-3">
                  {loading ? (
                    <p className="text-sm text-ink/50">Loading interventions...</p>
                  ) : (
                    (overview?.topInterventionTypes || []).map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-[18px] bg-paper px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-paper">
                            {typeIcon(item.label)}
                          </span>
                          <p className="text-sm font-semibold text-ink">{item.label}</p>
                        </div>
                        <p className="text-sm font-semibold text-ink/55">{item.count}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Recent Activity</p>
                <div className="mt-4 space-y-3">
                  {loading ? (
                    <p className="text-sm text-ink/50">Loading recent logs...</p>
                  ) : (
                    (overview?.recentActivity || []).slice(0, 8).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-[18px] bg-paper px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{item.intervention_type}</p>
                          <p className="text-xs text-ink/45">{item.athlete_name}</p>
                        </div>
                        <p className="text-xs text-ink/40">{timeAgo(item.inserted_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Recent Invites</p>
                <div className="mt-4 space-y-3">
                  {loading ? (
                    <p className="text-sm text-ink/50">Loading invites...</p>
                  ) : (
                    (overview?.recentInvites || []).slice(0, 8).map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between rounded-[18px] bg-paper px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{invite.email || 'Email not entered'}</p>
                          <p className="text-xs text-ink/45">Created {formatShortDate(invite.created_at)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          invite.used_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {invite.used_at ? 'Used' : 'Pending'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {activeTab === 'roster' ? (
          <section className="rounded-[30px] border border-ink/10 bg-white shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            {!loading ? (
              <div className="grid grid-cols-2 gap-3 border-b border-ink/8 px-5 py-5 sm:grid-cols-4">
                <StatCard label="Athletes total" value={athletes.length} detail="All accounts" />
                <StatCard label="Active this week" value={activeThisWeek} detail="Recent loggers" tone="success" />
                <StatCard label="Onboarded" value={onboarded} detail="Finished setup" />
                <StatCard label="Total logs" value={totalInterventions} detail="Lifetime intervention entries" />
              </div>
            ) : null}

            {loading ? (
              <div className="px-6 py-8 text-sm text-ink/50">Loading roster...</div>
            ) : athletes.length === 0 ? (
              <div className="px-6 py-8 text-sm text-ink/50">No athletes found.</div>
            ) : (
              <div className="divide-y divide-ink/6">
                {athletes.map((athlete) => (
                  <div key={athlete.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedAthlete(expandedAthlete === athlete.id ? null : athlete.id)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-ink/2"
                    >
                      <div className="flex items-center gap-3">
                        <ActivityDot lastDate={athlete.last_intervention_at} />
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {athlete.name || <span className="text-ink/35">Unnamed</span>}
                            {athlete.is_admin ? (
                              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Admin</span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-xs text-ink/40">
                            {athlete.email || 'No email'} · Joined {formatShortDate(athlete.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-semibold text-ink">{athlete.intervention_count}</p>
                          <p className="text-xs text-ink/40">logs</p>
                        </div>
                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-semibold text-ink">
                            {athlete.last_intervention_at ? timeAgo(athlete.last_intervention_at) : '—'}
                          </p>
                          <p className="text-xs text-ink/40">last log</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          athlete.onboarding_complete
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {athlete.onboarding_complete ? 'Active' : 'Onboarding'}
                        </span>
                      </div>
                    </button>

                    {expandedAthlete === athlete.id ? (
                      <div className="border-t border-ink/6 bg-paper px-5 py-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                          Recent logs
                        </p>
                        {logs.filter((log) => log.athlete_id === athlete.id).slice(0, 5).length === 0 ? (
                          <p className="text-sm text-ink/40">No logs yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {logs.filter((log) => log.athlete_id === athlete.id).slice(0, 5).map((log) => (
                              <div key={log.id} className="flex items-center gap-3 rounded-[14px] border border-ink/10 bg-white px-3 py-2.5">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-paper">
                                  {typeIcon(log.intervention_type)}
                                </span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-ink">{log.intervention_type}</p>
                                </div>
                                <p className="text-xs text-ink/40">{timeAgo(getLogTime(log))}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'activity' ? (
          <section className="rounded-[30px] border border-ink/10 bg-white shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            {loading ? (
              <div className="px-6 py-8 text-sm text-ink/50">Loading activity...</div>
            ) : logs.length === 0 ? (
              <div className="px-6 py-8 text-sm text-ink/50">No logs yet.</div>
            ) : (
              <>
                <div className="border-b border-ink/8 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                    Last {logs.length} logs across all athletes
                  </p>
                </div>
                <div className="divide-y divide-ink/6">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-paper">
                        {typeIcon(log.intervention_type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{log.intervention_type}</p>
                        <p className="text-xs text-ink/45">{log.athletes?.name || 'Unknown athlete'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-ink/35">{timeAgo(getLogTime(log))}</p>
                        <p className="text-xs text-ink/30">{formatDateTime(getLogTime(log))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : null}

        {activeTab === 'invite' ? (
          <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Invite Control</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Create private invitation links</h2>
                <p className="mt-3 text-sm leading-6 text-ink/60">
                  This is useful because it lets you control who gets into the product, track pending invites, and keep the operator workflow in one admin surface.
                </p>

                <form onSubmit={createInvite} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink/55">
                      Recipient email <span className="font-normal text-ink/35">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="athlete@example.com"
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink/55">
                      Notes <span className="font-normal text-ink/35">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={inviteNotes}
                      onChange={(event) => setInviteNotes(event.target.value)}
                      placeholder="running club, friend, coaching lead"
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  {inviteError ? <p className="text-sm text-red-600">{inviteError}</p> : null}

                  <button
                    type="submit"
                    disabled={inviteCreating}
                    className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper disabled:opacity-40"
                  >
                    {inviteCreating ? 'Generating...' : 'Generate invite link'}
                  </button>
                </form>

                {inviteLink ? (
                  <div className="mt-6 rounded-[22px] bg-paper p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Share this link</p>
                    <p className="break-all rounded-xl bg-white px-4 py-3 font-mono text-sm text-ink shadow-inner">
                      {inviteLink}
                    </p>
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      className="mt-3 rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink/5"
                    >
                      {inviteCopied ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] bg-paper p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Recent invites</p>
                    <p className="mt-1 text-sm text-ink/55">Latest invitation activity from the admin API</p>
                  </div>
                  <a href="/invite" className="text-sm font-semibold text-ink/55 underline underline-offset-4">
                    Open full list
                  </a>
                </div>

                <div className="mt-4 space-y-3">
                  {(overview?.recentInvites || []).slice(0, 8).map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between rounded-[18px] border border-ink/10 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{invite.email || 'Email not entered'}</p>
                        <p className="text-xs text-ink/45">Created {formatShortDate(invite.created_at)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        invite.used_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {invite.used_at ? 'Used' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export async function getServerSideProps(context) {
  try {
    const adminContext = await getAdminRequestContext(context.req);

    if (adminContext.authorized) {
      return { props: {} };
    }

    if (!adminContext.authenticated || adminContext.reason === 'invalid_admin_session') {
      return {
        redirect: {
          destination: '/login?next=/admin',
          permanent: false,
        },
      };
    }

    return {
      redirect: {
        destination: '/dashboard',
        permanent: false,
      },
    };
  } catch (error) {
    console.error('[admin page] auth guard failed:', error);
    return {
      redirect: {
        destination: '/login?next=/admin',
        permanent: false,
      },
    };
  }
}
