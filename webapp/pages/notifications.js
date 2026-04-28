import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';

function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function broadcastUnreadNotificationCount(notifications = []) {
  if (typeof window === 'undefined') return;

  const unreadCount = notifications.filter((item) => !item.is_read && !item.is_archived).length;
  window.dispatchEvent(
    new CustomEvent('threshold:notifications-unread-count', {
      detail: { unreadCount },
    })
  );
}

function NotificationCard({ item, onAction, busyId }) {
  return (
    <div className={`rounded-[24px] border p-5 shadow-[0_14px_28px_rgba(19,24,22,0.05)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_36px_rgba(19,24,22,0.08)] ${item.is_read ? 'border-border-subtle bg-white' : 'border-amber-200 bg-amber-50/40'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-paper px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/55">
            {item.badge || 'Notification'}
          </span>
          <p className="mt-3 text-base font-semibold text-ink">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-ink/65">{item.body}</p>
        </div>
        <p className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-ink/40">
          {formatTimestamp(item.occurred_at)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.href ? (
          <Link href={item.href} className="rounded-full border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/70">
            Open
          </Link>
        ) : null}
        <button
          type="button"
          disabled={busyId === item.id}
          onClick={() => onAction(item.id, item.is_read ? 'unread' : 'read')}
          className="rounded-full border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/70"
        >
          {busyId === item.id ? 'Saving…' : item.is_read ? 'Mark unread' : 'Mark read'}
        </button>
        <button
          type="button"
          disabled={busyId === item.id}
          onClick={() => onAction(item.id, 'archive')}
          className="rounded-full border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/70"
        >
          {busyId === item.id ? 'Saving…' : 'Archive'}
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [me, setMe] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [sourceCounts, setSourceCounts] = useState({ messages: 0, contextComments: 0, coachAlerts: 0, workoutUploads: 0 });
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      setLoading(true);
      try {
        const [meRes, notificationRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/notifications'),
        ]);

        const meData = await meRes.json();
        const notificationData = await notificationRes.json();

        if (!meRes.ok) throw new Error(meData.error || 'Could not load notification context.');
        if (!notificationRes.ok) throw new Error(notificationData.error || 'Could not load notifications.');
        if (cancelled) return;

        setMe(meData);
        setNotifications(notificationData.notifications || []);
        setSourceCounts(notificationData.sourceCounts || { messages: 0, contextComments: 0, coachAlerts: 0, workoutUploads: 0 });
        broadcastUnreadNotificationCount(notificationData.notifications || []);
        setError('');
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  async function handleNotificationAction(id, action) {
    setBusyId(id);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update notification.');

      setNotifications(data.notifications || []);
      setSourceCounts(data.sourceCounts || { messages: 0, contextComments: 0, coachAlerts: 0, workoutUploads: 0 });
      broadcastUnreadNotificationCount(data.notifications || []);
      setError('');
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Notifications</p>
          <NavMenu label="Notifications navigation" primaryLink={{ href: '/messages', label: 'Messages', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/notifications"
          tabs={[
            { href: '/messages', label: 'Messages' },
            { href: '/notifications', label: 'Notifications' },
            { href: '/settings', label: 'Settings' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#f3ebdf_0%,#d8cab4_48%,#987c5a_100%)] p-6 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Notifications</p>
              <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Notification center</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/68">
                Messages, protocol comments, intervention feedback, and coach attention items now live in one stored feed.
              </p>
            </div>
            <div className="rounded-[24px] bg-white/70 px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Unread messages</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{Number(me?.unreadMessageCount || 0)}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-ink/42">{unreadNotifications} unread notifications</p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-8 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="mt-10 rounded-[30px] border border-ink/10 bg-white p-8 text-sm text-ink/58 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            Loading notifications…
          </section>
        ) : (
          <>
            <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs uppercase tracking-[0.18em] text-accent">Messages</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{sourceCounts.messages}</p>
                <p className="mt-2 text-sm text-ink/60">Unread message notifications stored for you.</p>
              </div>
              <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs uppercase tracking-[0.18em] text-accent">Workout uploads</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{sourceCounts.workoutUploads}</p>
                <p className="mt-2 text-sm text-ink/60">New Strava workouts waiting for a Workout Check-in.</p>
              </div>
              <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs uppercase tracking-[0.18em] text-accent">Context comments</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{sourceCounts.contextComments}</p>
                <p className="mt-2 text-sm text-ink/60">Comments tied directly to protocols and intervention logs.</p>
              </div>
              <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-xs uppercase tracking-[0.18em] text-accent">Coach feed</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{sourceCounts.coachAlerts}</p>
                <p className="mt-2 text-sm text-ink/60">Stored dashboard attention items, when you act as a coach.</p>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-accent">Latest</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Stored notification feed</h2>
                </div>
                <Link href="/messages" className="ui-button-secondary py-2">
                  Open inbox
                </Link>
              </div>

              <div className="mt-5 space-y-4">
                {notifications.length ? (
                  notifications.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onAction={handleNotificationAction}
                      busyId={busyId}
                    />
                  ))
                ) : (
                  <div className="rounded-[30px] border border-dashed border-ink/10 bg-white px-6 py-10 text-center text-sm text-ink/58">
                    No notifications yet. Once messages or contextual comments arrive, they will appear here until you archive them.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
