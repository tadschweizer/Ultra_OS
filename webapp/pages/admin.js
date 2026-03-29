import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

/**
 * /admin — Admin dashboard
 *
 * Shows all athletes, their last active date, intervention count,
 * and onboarding status. Admin-only.
 */

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function ActivityDot({ lastDate }) {
  if (!lastDate) return <span className="h-2.5 w-2.5 rounded-full bg-ink/12" />;
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />;
  if (days <= 21) return <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />;
  return <span className="h-2.5 w-2.5 rounded-full bg-red-400" />;
}

export default function AdminPage() {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notAdmin, setNotAdmin] = useState(false);
  const [error, setError] = useState('');

  // Summary stats
  const totalInterventions = athletes.reduce((s, a) => s + a.intervention_count, 0);
  const activeThisWeek = athletes.filter((a) => {
    if (!a.last_intervention_at) return false;
    return (Date.now() - new Date(a.last_intervention_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
  }).length;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/athletes');
        if (res.status === 403 || res.status === 401) { setNotAdmin(true); return; }
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to load'); return; }
        setAthletes(data.athletes || []);
      } catch (_) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (notAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-8">
        <div className="max-w-sm rounded-[30px] border border-ink/10 bg-white p-8 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-2xl">🔒</p>
          <p className="mt-4 font-semibold text-ink">Admin access required</p>
          <p className="mt-2 text-sm text-ink/55">This page is only available to UltraOS admins.</p>
          <a href="/dashboard" className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
            Back to dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Admin</p>
          </div>
          <NavMenu />
        </div>

        {/* Hero */}
        <div className="mb-6 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
            Admin Dashboard
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            Manage athletes, monitor activity, and generate invites.
          </p>

          {!loading && (
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-[22px] bg-white/70 px-4 py-4 backdrop-blur">
                <p className="text-2xl font-semibold text-ink">{athletes.length}</p>
                <p className="mt-1 text-xs text-ink/50">Total athletes</p>
              </div>
              <div className="rounded-[22px] bg-white/70 px-4 py-4 backdrop-blur">
                <p className="text-2xl font-semibold text-ink">{activeThisWeek}</p>
                <p className="mt-1 text-xs text-ink/50">Active this week</p>
              </div>
              <div className="rounded-[22px] bg-white/70 px-4 py-4 backdrop-blur">
                <p className="text-2xl font-semibold text-ink">{totalInterventions}</p>
                <p className="mt-1 text-xs text-ink/50">Total logs</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mb-6 flex flex-wrap gap-3">
          <a
            href="/invite"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 stroke-paper" strokeWidth="1.75" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New invite
          </a>
          <a
            href="/connections"
            className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink"
          >
            Connections
          </a>
        </div>

        {/* Athlete table */}
        <section className="rounded-[30px] border border-ink/10 bg-white shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="border-b border-ink/8 px-6 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Athletes {athletes.length > 0 ? `(${athletes.length})` : ''}
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-sm text-ink/50">Loading…</div>
          ) : error ? (
            <div className="px-6 py-8 text-sm text-red-600">{error}</div>
          ) : athletes.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-ink/50">No athletes yet.</p>
              <a href="/invite" className="mt-3 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                Send first invite →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-ink/6">
              {athletes.map((athlete) => (
                <div key={athlete.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <ActivityDot lastDate={athlete.last_intervention_at} />
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {athlete.name || <span className="text-ink/35">Unnamed athlete</span>}
                        {athlete.is_admin ? (
                          <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                            Admin
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-ink/40">
                        {athlete.email || 'No email'}
                        {' · '}
                        Joined {new Date(athlete.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-ink">{athlete.intervention_count}</p>
                      <p className="text-xs text-ink/40">logs</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-ink">
                        {athlete.last_intervention_at ? daysAgo(athlete.last_intervention_at) : '—'}
                      </p>
                      <p className="text-xs text-ink/40">last log</p>
                    </div>
                    <div>
                      {athlete.onboarding_complete ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Onboarding
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 px-2">
          <div className="flex items-center gap-1.5 text-xs text-ink/40">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Active (last 7 days)
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink/40">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Slowing (8–21 days)
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink/40">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Inactive (21+ days)
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink/40">
            <span className="h-2.5 w-2.5 rounded-full bg-ink/12" /> No logs yet
          </div>
        </div>
      </div>
    </main>
  );
}
