import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { notificationLink } from '../lib/notificationPreferences';
import { MESSAGE_REFRESH_EVENT } from '../lib/messageClient';
import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';

const NOTIFICATION_FIELDS = [
  { key: 'coach_message', label: 'New coach messages' },
  { key: 'coach_note_reply', label: 'Replies to coach notes and threads' },
  { key: 'protocol_assignment_comment', label: 'Protocol assignment comments' },
  { key: 'workout_comment', label: 'Workout/day-specific comments' },
  { key: 'athlete_message', label: 'New athlete messages' },
  { key: 'compliance_miss_alert', label: 'Compliance miss evidence cards' },
  { key: 'hrv_trend_alert', label: 'HRV trend evidence cards' },
  { key: 'sleep_dip_alert', label: 'Sleep dip evidence cards' },
];

export default function NotificationsPage() {
  const navLinks = [
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/settings', label: 'Settings' },
    { href: '/account', label: 'Account' },
  ];

  const [prefs, setPrefs] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState('');

  const [actorId, setActorId] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const version = useRef(0);

  const load = useCallback(async (before = null) => {
    const current = ++version.current;
    try {
      const res = await fetch(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ''}`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load notifications.');
      if (current !== version.current) return;
      setPrefs(data.preferences || {});
      setActorId(data.actor_id);
      setNotifications(items => before ? [...new Map([...items, ...data.notifications].map(item => [item.id, item])).values()] : data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      setNextCursor(data.next_cursor || null);
      setLoaded(true);
    } catch (error) {
      if (current === version.current) setStatus(error.message || 'Unable to load notifications.');
    }
  }, []);

  useEffect(() => {
    const refresh = () => { if (!busyRef.current && document.visibilityState !== 'hidden') load(); };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener(MESSAGE_REFRESH_EVENT, refresh);
    return () => { version.current++; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); window.removeEventListener(MESSAGE_REFRESH_EVENT, refresh); };
  }, [load]);

  async function markNotificationsRead(notificationId = null) {
    if (busyRef.current) return;
    const ids = notifications.filter(item => !item.read_at && (!notificationId || item.id === notificationId)).map(item => item.id);
    if (!ids.length) return;
    busyRef.current = true; setBusy(true); version.current++;
    try {
      for (let offset = 0; offset < ids.length; offset += 50) {
        const res = await fetch('/api/notifications', {
          method: 'PATCH', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mark_read: true, notification_ids: ids.slice(offset, offset + 50) }),
        });
        if (!res.ok) throw new Error('Could not mark notifications read. Please retry.');
      }
      setStatus('Marked shown notifications read.');
    } catch (error) { setStatus(error.message); }
    finally { await load(); busyRef.current = false; setBusy(false); }
  }

  async function togglePref(key, value) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); version.current++;
    setStatus('Saving preference…');
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { [key]: value } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Could not save preference. Please retry.');
      setPrefs(data.preferences); setStatus('Saved.');
    } catch (error) { setStatus(error.message); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Notifications</p>
          <NavMenu label="Notifications navigation" links={navLinks} primaryLink={{ href: '/settings', label: 'Settings', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/notifications"
          tabs={[
            { href: '/guide', label: 'Guide' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/notifications', label: 'Notifications' },
            { href: '/settings', label: 'Settings' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#f3ebdf_0%,#d8cab4_48%,#987c5a_100%)] p-6 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Notifications</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Notification preferences</h1>
          <p className="mt-4 max-w-2xl text-sm text-ink/70">Choose which new replies appear in your in-app notification feed. These settings do not change message unread counts. Email and push delivery are not enabled here.</p>
        </section>


        {status && <p role="status" className="mt-4 text-sm text-ink/70">{status}</p>}
        {!loaded && <button onClick={() => load()} className="mt-4 text-sm underline">Retry loading notifications</button>}
        <section className="mt-12 rounded-3xl border border-ink/10 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Activity feed</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Latest notifications</h2>
            </div>
            {notifications.length ? (
              <button
                disabled={busy}
                onClick={() => markNotificationsRead()}
                className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5"
              >
                Mark shown read ({unreadCount} unread total)
              </button>
            ) : null}
          </div>
          {!notifications.length ? (
            <p className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-paper p-4 text-sm text-ink/60">
              No notifications yet. New messages and session comments will appear here as they arrive.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {notifications.map((notification) => (
                <article key={notification.id} className={`rounded-2xl border p-4 ${notification.read_at ? 'border-ink/8 bg-paper' : 'border-accent/30 bg-accent/5'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{notification.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/40">{notification.notification_type}</p>
                    </div>
                    {!notification.read_at ? (
                      <button disabled={busy} onClick={() => markNotificationsRead(notification.id)} className="rounded-full border border-accent/30 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/5">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                  {notificationLink(notification, actorId) && <Link href={notificationLink(notification, actorId)} className="mt-3 inline-block text-sm underline">Open conversation</Link>}
                  {notification.body ? <p className="mt-3 text-sm leading-6 text-ink/70">{notification.body}</p> : null}
                  <p className="mt-3 text-xs text-ink/40">{new Date(notification.created_at).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {nextCursor && <button disabled={busy} onClick={async () => { busyRef.current = true; setBusy(true); await load(nextCursor); busyRef.current = false; setBusy(false); }} className="mt-4 rounded-full border border-ink/20 px-4 py-2 text-sm">Load older notifications</button>}
        <section className="mt-12 rounded-3xl border border-ink/10 bg-white p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">In-app preferences</p>
          <div className="mt-4 space-y-4">
            {NOTIFICATION_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 px-4 py-3">
                <span className="text-sm text-ink">{field.label}</span>
                <input type="checkbox" disabled={!loaded || busy} checked={Boolean(prefs[field.key])} onChange={(e) => togglePref(field.key, e.target.checked)} />
              </label>
            ))}
          </div>

        </section>
      </div>
    </main>
  );
}
