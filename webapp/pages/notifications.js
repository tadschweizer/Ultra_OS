import { useEffect, useState } from 'react';
import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';

const NOTIFICATION_FIELDS = [
  { key: 'coach_note_reply', label: 'Replies to coach notes and threads' },
  { key: 'protocol_assignment_comment', label: 'Protocol assignment comments' },
  { key: 'workout_comment', label: 'Workout/day-specific comments' },
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
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/notifications').then((r) => r.json()).then((d) => setPrefs(d.preferences || {})).catch(() => setStatus('Unable to load preferences.'));
  }, []);

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
