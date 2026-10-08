import { MESSAGE_REFRESH_EVENT } from '../lib/messageClient';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isCoachRoute } from '../lib/siteNavigation';

/**
 * Global message center: a floating button (top-right on desktop, above the
 * bottom nav on mobile) with an unread badge, opening a popup that unifies
 * the two coaching channels — direct coach↔athlete messages and per-session
 * discussions, where a session is a planned workout or a completed activity.
 */

// Short sport codes rather than icons — they stay legible and on-brand.
const SPORT_CODE = {
  run: 'RUN', bike: 'BIKE', swim: 'SWIM', strength: 'STR', row: 'ROW', ski: 'SKI', hike: 'HIKE', other: 'OTH',
};

function sportCode(sport) {
  return SPORT_CODE[sport] || (sport ? String(sport).slice(0, 4).toUpperCase() : 'OTH');
}

function timeAgo(value) {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diffMs)) return '';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ChatIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

export default function MessageCenter() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('direct');
  const coachingFlow = (router.pathname === '/messages' && router.query.mode !== 'athlete') || isCoachRoute(router.pathname);

  const refresh = useCallback(async () => {
    try {
      const modeQuery = coachingFlow ? '?mode=coach' : '';
      const res = await fetch(`/api/message-center${modeQuery}`);
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data);
    } catch {
      // Silent: the badge just stays stale until the next poll.
    }
  }, [coachingFlow]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, open ? 4000 : 30000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener(MESSAGE_REFRESH_EVENT, onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(MESSAGE_REFRESH_EVENT, onFocus);
    };
  }, [refresh, open]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openThread = useCallback((conversation) => {
    setOpen(false);
    router.push(`/messages?athlete_id=${encodeURIComponent(conversation.athlete_id)}&mode=${summary?.role || 'athlete'}`);
  }, [router, summary?.role]);

  // A session thread hangs off either a planned workout or an imported
  // activity, so both the mark-read call and the calendar deep link name the
  // subject the thread actually has.
  const openSessionThread = useCallback(async (sessionThread) => {
    const subjectParam = sessionThread.subject_type === 'activity' ? 'activity' : 'workout';
    await fetch('/api/message-center', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark_read',
        scope: 'workout',
        mode: summary?.role || 'athlete',
        [`${subjectParam}_id`]: sessionThread.subject_id,
      }),
    }).catch(() => {});
    setOpen(false);
    const deepLink = `${subjectParam}=${encodeURIComponent(sessionThread.subject_id)}`;
    const target = summary?.role === 'coach'
      ? `/coach/training-calendar?athlete=${encodeURIComponent(sessionThread.athlete_id)}&${deepLink}`
      : `/calendar?${deepLink}`;
    router.push(target);
  }, [router, summary?.role]);

  if (!summary || !summary.has_messaging) return null;

  const unread = summary.unread_total || 0;
  const conversations = summary.conversations || [];
  const sessionThreads = summary.workout_threads || [];
  const myRole = summary.role;

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) { refresh(); } }}
        aria-label={unread ? `Messages (${unread} unread)` : 'Messages'}
        className="fixed bottom-24 right-4 z-[64] flex h-12 w-12 items-center justify-center rounded-full border border-ink/10 bg-white text-ink shadow-[0_4px_20px_rgba(19,24,22,0.14)] transition hover:scale-105 lg:bottom-auto lg:top-4 lg:right-5"
      >
        <ChatIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="fixed bottom-40 right-3 z-[66] flex max-h-[70vh] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-ink/10 bg-white shadow-[0_16px_60px_rgba(19,24,22,0.22)] lg:bottom-auto lg:right-5 lg:top-[72px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink/8 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink">Messages</p>
                {unread > 0 && (
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600">{unread} unread</span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full border border-ink/10 px-2.5 py-1 text-xs text-ink/60 hover:bg-ink/5">✕</button>
            </div>
            <>
                {/* Tabs */}
                <div className="flex gap-1 border-b border-ink/8 px-4 pt-2.5">
                  {[
                    { id: 'direct', label: myRole === 'coach' ? 'Athletes' : 'Coach' },
                    { id: 'workouts', label: 'Sessions' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`rounded-t-xl px-3.5 py-2 text-xs font-semibold transition ${tab === t.id ? 'border-b-2 border-accent text-ink' : 'text-ink/45 hover:text-ink/70'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-[220px] flex-1 overflow-y-auto p-3">
                  {tab === 'direct' ? (
                    conversations.length ? (
                      <div className="space-y-1.5">
                        {conversations.map((c) => (
                          <button
                            key={c.athlete_id}
                            onClick={() => openThread(c)}
                            className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition hover:border-ink/10 hover:bg-paper"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel text-sm font-bold text-paper">
                              {(c.name || '?').slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold text-ink">{c.name}</span>
                                <span className="shrink-0 text-[10px] text-ink/40">{timeAgo(c.last_message?.created_at)}</span>
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-ink/50">
                                {c.last_message ? c.last_message.message_body : 'No messages yet'}
                              </span>
                            </span>
                            {c.unread > 0 && (
                              <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{c.unread}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-8 text-center text-sm text-ink/50">
                        {myRole === 'coach' ? 'No active athletes yet.' : 'Connect with a coach to start messaging.'}
                      </p>
                    )
                  ) : sessionThreads.length ? (
                    <div className="space-y-1.5">
                      {sessionThreads.map((t) => (
                        <button
                          key={`${t.subject_type}:${t.subject_id}`}
                          onClick={() => openSessionThread(t)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition hover:border-ink/10 hover:bg-paper"
                        >
                          {/* An activity ring reads as "already done"; a plan stays neutral. */}
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold tracking-wide ${t.subject_type === 'activity' ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' : 'bg-paper text-ink/50'}`}>
                            {sportCode(t.sport)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-ink">{t.title}</span>
                              <span className="shrink-0 text-[10px] text-ink/40">{timeAgo(t.last_comment?.created_at)}</span>
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5">
                              {t.subject_type === 'activity' && (
                                <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">Completed</span>
                              )}
                              <span className="min-w-0 truncate text-xs text-ink/50">
                                {myRole === 'coach' ? `${t.name} · ` : ''}{t.date || ''}{t.last_comment ? ` — ${t.last_comment.body}` : ''}
                              </span>
                            </span>
                          </span>
                          {t.unread > 0 && (
                            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{t.unread}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-8 px-4 text-center text-sm text-ink/50">
                      No session discussions yet. Open any workout or completed activity on the calendar and use its discussion box to ask about that specific session.
                    </p>
                  )}
                </div>

                <a href="/messages" className="block border-t border-ink/8 px-5 py-3 text-center text-xs font-semibold text-accent hover:bg-paper">
                  Open full message board →
                </a>
            </>
          </div>
        </>
      )}
    </>
  );
}
