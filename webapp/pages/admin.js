import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

/**
 * /admin — Admin dashboard
 *
 * Shows athlete roster, recent activity feed, and inline invite generation.
 * Accessible via NavMenu admin toggle (amber banner). Admin-only.
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

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return daysAgo(dateStr);
}

function ActivityDot({ lastDate }) {
  if (!lastDate) return <span title="No logs yet" className="h-2.5 w-2.5 rounded-full bg-ink/12" />;
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return <span title="Active this week" className="h-2.5 w-2.5 rounded-full bg-emerald-500" />;
  if (days <= 21) return <span title="Slowing down" className="h-2.5 w-2.5 rounded-full bg-amber-400" />;
  return <span title="Inactive 21+ days" className="h-2.5 w-2.5 rounded-full bg-red-400" />;
}

// Intervention type → emoji
function typeIcon(type) {
  const map = {
    'Heat Acclimation': '🔥', 'Altitude': '⛰️', 'Sleep': '😴', 'Cold Exposure': '🧊',
    'Gut Training': '🫀', 'Sodium Bicarbonate': '🧪', 'Carbohydrate Loading': '🍝',
    'Strength Training': '🏋️', 'HRV': '💓', 'Sauna': '🧖', 'Trekking Poles': '🥢',
    'Workout Check-in': '✅',
  };
  return map[type] || '📋';
}

export default function AdminPage() {
  const [athletes, setAthletes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notAdmin, setNotAdmin] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'activity' | 'invite'

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNotes, setInviteNotes] = useState('');
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Expanded athlete rows
  const [expandedAthlete, setExpandedAthlete] = useState(null);

  const totalInterventions = athletes.reduce((s, a) => s + a.intervention_count, 0);
  const activeThisWeek = athletes.filter((a) => {
    if (!a.last_intervention_at) return false;
    return (Date.now() - new Date(a.last_intervention_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const onboarded = athletes.filter((a) => a.onboarding_complete).length;

  useEffect(() => {
    async function load() {
      try {
        const [rosterRes, logsRes] = await Promise.all([
          fetch('/api/admin/athletes'),
          fetch('/api/admin/recent-logs?limit=30'),
        ]);
        if (rosterRes.status === 403 || rosterRes.status === 401) { setNotAdmin(true); return; }
        const rosterData = await rosterRes.json();
        const logsData = logsRes.ok ? await logsRes.json() : { logs: [] };
        if (!rosterRes.ok) { setError(rosterData.error || 'Failed to load'); return; }
        setAthletes(rosterData.athletes || []);
        setLogs(logsData.logs || []);
      } catch (_) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function createInvite(e) {
    e.preventDefault();
    setInviteCreating(true);
    setInviteError('');
    setInviteLink('');
    setInviteCopied(false);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() || null, notes: inviteNotes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error || 'Create failed'); return; }
      setInviteLink(data.joinUrl);
      setInviteEmail('');
      setInviteNotes('');
    } catch (_) {
      setInviteError('Network error');
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

  if (notAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-8">
        <div className="max-w-sm rounded-[30px] border border-ink/10 bg-white p-8 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-2xl">🔒</p>
          <p className="mt-4 font-semibold text-ink">Admin access required</p>
          <p className="mt-2 text-sm text-ink/55">This page is only available to Threshold admins.</p>
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

        {/* Header */}
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">A</span>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Admin</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-xs font-semibold text-ink transition hover:bg-ink hover:text-paper"
            >
              ← Athlete view
            </a>
            <NavMenu />
          </div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[22px] border border-ink/10 bg-white px-4 py-4 shadow-sm">
              <p className="text-2xl font-semibold text-ink">{athletes.length}</p>
              <p className="mt-0.5 text-xs text-ink/45">Athletes total</p>
            </div>
            <div className="rounded-[22px] border border-ink/10 bg-white px-4 py-4 shadow-sm">
              <p className="text-2xl font-semibold text-emerald-600">{activeThisWeek}</p>
              <p className="mt-0.5 text-xs text-ink/45">Active this week</p>
            </div>
            <div className="rounded-[22px] border border-ink/10 bg-white px-4 py-4 shadow-sm">
              <p className="text-2xl font-semibold text-ink">{onboarded}</p>
              <p className="mt-0.5 text-xs text-ink/45">Onboarded</p>
            </div>
            <div className="rounded-[22px] border border-ink/10 bg-white px-4 py-4 shadow-sm">
              <p className="text-2xl font-semibold text-ink">{totalInterventions}</p>
              <p className="mt-0.5 text-xs text-ink/45">Total logs</p>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="mb-5 inline-flex rounded-full border border-ink/10 bg-white p-1 shadow-sm">
          {[
            { key: 'roster', label: `Roster (${athletes.length})` },
            { key: 'activity', label: `Activity (${logs.length})` },
            { key: 'invite', label: '+ Invite' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === key ? 'bg-ink text-paper shadow-sm' : 'text-ink/55 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-[22px] bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>
        ) : null}

        {/* ── Roster tab ───────────────────────────────────── */}
        {activeTab === 'roster' && (
          <section className="rounded-[30px] border border-ink/10 bg-white shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            {loading ? (
              <div className="px-6 py-8 text-sm text-ink/50">Loading…</div>
            ) : athletes.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-ink/50">No athletes yet.</p>
                <button type="button" onClick={() => setActiveTab('invite')} className="mt-3 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                  Send first invite →
                </button>
              </div>
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
                            {athlete.email || 'No email'} · Joined {new Date(athlete.created_at).toLocaleDateString()}
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
                            {athlete.last_intervention_at ? daysAgo(athlete.last_intervention_at) : '—'}
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
                        <svg
                          viewBox="0 0 16 16" fill="none"
                          className={`h-4 w-4 flex-shrink-0 stroke-ink/30 transition-transform ${expandedAthlete === athlete.id ? 'rotate-90' : ''}`}
                          strokeWidth="1.75" strokeLinecap="round"
                        >
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded row — athlete's recent logs from the feed */}
                    {expandedAthlete === athlete.id && (
                      <div className="border-t border-ink/6 bg-paper px-5 py-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                          Recent logs
                        </p>
                        {logs.filter((l) => l.athlete_id === athlete.id).slice(0, 5).length === 0 ? (
                          <p className="text-sm text-ink/40">No logs yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {logs.filter((l) => l.athlete_id === athlete.id).slice(0, 5).map((log) => (
                              <div key={log.id} className="flex items-center gap-3 rounded-[14px] border border-ink/10 bg-white px-3 py-2.5">
                                <span className="text-base">{typeIcon(log.intervention_type)}</span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-ink">{log.intervention_type}</p>
                                </div>
                                <p className="text-xs text-ink/40">{timeAgo(log.logged_at)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Activity tab ─────────────────────────────────── */}
        {activeTab === 'activity' && (
          <section className="rounded-[30px] border border-ink/10 bg-white shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            {loading ? (
              <div className="px-6 py-8 text-sm text-ink/50">Loading…</div>
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
                      <span className="text-xl">{typeIcon(log.intervention_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{log.intervention_type}</p>
                        <p className="text-xs text-ink/45">{log.athletes?.name || 'Unknown athlete'}</p>
                      </div>
                      <p className="shrink-0 text-xs text-ink/35">{timeAgo(log.logged_at)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ── Invite tab ───────────────────────────────────── */}
        {activeTab === 'invite' && (
          <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="mb-1 text-base font-semibold text-ink">Invite a new athlete</p>
            <p className="mb-6 text-sm text-ink/55">
              Generate a sign-up link. They open it, connect Strava, and they're in — no password required.
            </p>

            <form onSubmit={createInvite} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink/55">
                  Their email <span className="font-normal text-ink/35">(optional — for your records)</span>
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="athlete@example.com"
                  className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink/55">
                  Notes <span className="font-normal text-ink/35">(optional — e.g. "running club")</span>
                </label>
                <input
                  type="text"
                  value={inviteNotes}
                  onChange={(e) => setInviteNotes(e.target.value)}
                  placeholder="How do you know this person?"
                  className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>

              {inviteError ? <p className="text-sm text-red-600">{inviteError}</p> : null}

              <button
                type="submit"
                disabled={inviteCreating}
                className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper disabled:opacity-40"
              >
                {inviteCreating ? 'Generating…' : 'Generate invite link'}
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
                  {inviteCopied ? '✓ Copied!' : 'Copy link'}
                </button>
              </div>
            ) : null}

            <div className="mt-6 border-t border-ink/8 pt-5">
              <a href="/invite" className="text-sm font-semibold text-ink/45 underline underline-offset-4">
                View all invites →
              </a>
            </div>
          </section>
        )}

        {/* Legend */}
        {activeTab === 'roster' && !loading && athletes.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-4 px-1">
            <div className="flex items-center gap-1.5 text-xs text-ink/35">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active (≤7d)
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink/35">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Slowing (8–21d)
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink/35">
              <span className="h-2 w-2 rounded-full bg-red-400" /> Inactive (21d+)
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink/35">
              <span className="h-2 w-2 rounded-full bg-ink/12" /> No logs
            </div>
            <span className="text-xs text-ink/25">· Click a row to expand</span>
          </div>
        )}
      </div>
    </main>
  );
}
