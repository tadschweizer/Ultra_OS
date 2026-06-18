import { useEffect, useState } from 'react';
import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';

const NOTIFICATION_FIELDS = [
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
  const [coachNotifications, setCoachNotifications] = useState([]);
  const [unreadCoachNotifications, setUnreadCoachNotifications] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => {
        setPrefs(d.preferences || {});
        setCoachNotifications(d.coachNotifications || []);
        setUnreadCoachNotifications(d.unreadCoachNotifications || 0);
      })
      .catch(() => setStatus('Unable to load preferences.'));
  }, []);

  async function markCoachNotificationsRead(notificationId = null) {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_read: true, notification_id: notificationId || undefined }),
    });
    if (!res.ok) {
      setStatus('Could not mark notification read.');
      return;
    }
    setCoachNotifications((items) => items.map((item) => (notificationId && item.id !== notificationId ? item : { ...item, read_at: item.read_at || new Date().toISOString() })));
    setUnreadCoachNotifications((count) => (notificationId ? Math.max(0, count - 1) : 0));
    setStatus('Marked read.');
  }

  async function togglePref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { [key]: value } }),
    });
    if (!res.ok) {
      setStatus('Could not save preference.');
      return;
    }
    setStatus('Saved.');
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
          <p className="mt-4 max-w-2xl text-sm text-ink/70">Control notifications for threaded coach conversations and evidence-card based alerts.</p>
        </section>


        <section className="mt-12 rounded-3xl border border-ink/10 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Coach activity feed</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Latest coach notifications</h2>
            </div>
            {coachNotifications.length ? (
              <button
                onClick={() => markCoachNotificationsRead()}
                className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5"
              >
                Mark all read ({unreadCoachNotifications})
              </button>
            ) : null}
          </div>
          {!coachNotifications.length ? (
            <p className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-paper p-4 text-sm text-ink/60">
              No coach notifications yet. Athlete messages and workout comments will appear here as they arrive.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {coachNotifications.map((notification) => (
                <article key={notification.id} className={`rounded-2xl border p-4 ${notification.read_at ? 'border-ink/8 bg-paper' : 'border-accent/30 bg-accent/5'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{notification.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/40">{notification.notification_type}</p>
                    </div>
                    {!notification.read_at ? (
                      <button onClick={() => markCoachNotificationsRead(notification.id)} className="rounded-full border border-accent/30 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/5">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                  {notification.body ? <p className="mt-3 text-sm leading-6 text-ink/70">{notification.body}</p> : null}
                  <p className="mt-3 text-xs text-ink/40">{new Date(notification.created_at).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 rounded-3xl border border-ink/10 bg-white p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">In-app hooks</p>
          <div className="mt-4 space-y-4">
            {NOTIFICATION_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 px-4 py-3">
                <span className="text-sm text-ink">{field.label}</span>
                <input type="checkbox" checked={Boolean(prefs[field.key])} onChange={(e) => togglePref(field.key, e.target.checked)} />
              </label>
            ))}
          </div>
          {status && <p className="mt-4 text-xs text-ink/60">{status}</p>}
        </section>
      </div>
    </main>
  );
}
