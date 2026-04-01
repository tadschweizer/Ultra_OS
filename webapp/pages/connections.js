import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import EmptyStateCard from '../components/EmptyStateCard';

const sources = [
  {
    name: 'Strava',
    status: 'Available now',
    href: '/api/strava/login',
    action: 'Connect',
    enabled: true,
  },
  {
    name: 'Garmin',
    status: 'Coming soon',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
  {
    name: 'COROS',
    status: 'Coming soon',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
  {
    name: 'Zwift',
    status: 'Coming soon',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
  {
    name: 'TrainingPeaks',
    status: 'Coming soon',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
];

export default function Connections() {
  const [athleteId, setAthleteId] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [notifyEmails, setNotifyEmails] = useState({});
  const [notifySubmitted, setNotifySubmitted] = useState({});
  const navLinks = athleteId
    ? [
        { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
        { href: '/connections', label: 'Connections', description: 'Manage linked training sources.' },
        { href: '/guide', label: 'Guide', description: 'Learn how connections fit into UltraOS.' },
        { href: '/log-intervention', label: 'Log Intervention', description: 'Add a new intervention entry.' },
        { href: '/history', label: 'Intervention History', description: 'Review what you have logged.' },
        { href: '/settings', label: 'Settings', description: 'Adjust athlete baselines and zones.' },
        { href: '/content', label: 'Content', description: 'Track the content and community workstream.' },
        { href: '/', label: 'Landing Page', description: 'Return to the marketing/login surface.' },
      ]
    : [{ href: '/', label: 'Landing Page', description: 'Return to the UltraOS entry page.' }];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/athlete_id=([^;]+)/);
      if (match) {
        setAthleteId(match[1]);
      }
    }
  }, []);

  useEffect(() => {
    async function loadAthlete() {
      const res = await fetch('/api/me');
      if (!res.ok) return;
      const data = await res.json();
      setAthlete(data.athlete || null);
    }

    if (athleteId) {
      loadAthlete();
    }
  }, [athleteId]);

  const hasAnyConnections = Boolean(athlete?.strava_id);
  const stravaLastSeen = athlete?.strava_last_sync || athlete?.updated_at || null;

  function handleNotifySubmit(sourceName) {
    const email = (notifyEmails[sourceName] || '').trim();
    if (!email) return;
    // Store locally — a real implementation would POST to an API
    setNotifySubmitted((prev) => ({ ...prev, [sourceName]: true }));
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Connections</p>
          </div>
          <NavMenu
            label="Connections navigation"
            links={navLinks}
            primaryLink={athleteId ? { href: '/dashboard', label: 'UltraOS Home' } : { href: '/', label: 'Landing Page', variant: 'secondary' }}
          />
        </div>

        {athleteId ? <DashboardTabs activeHref="/connections" /> : null}

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Source Linking</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Connect the sources behind your training.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                Connect the training sources you use and come back here any time you want to manage them.
              </p>
            </div>
          </div>
        </div>

        {!hasAnyConnections && athleteId ? (
          <section className="mt-2">
            <EmptyStateCard
              icon="network"
              title="No connections yet."
              body="Connect Strava or Garmin to pull activity context into your intervention log."
              ctaLabel="Add a Connection"
              ctaHref="/api/strava/login"
            />
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((source) => (
              <article key={source.name} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm uppercase tracking-[0.22em] text-accent">{source.name}</p>
                  <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">
                    {source.name === 'Strava' && hasAnyConnections ? 'Connected' : source.status}
                  </span>
                </div>
                {source.name === 'Strava' && hasAnyConnections && stravaLastSeen ? (
                  <p className="mt-2 text-xs text-ink/45">
                    Last synced: {new Date(stravaLastSeen).toLocaleString()}
                  </p>
                ) : null}
                {source.enabled ? (
                  <a href={source.href} className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
                    {source.name === 'Strava' && hasAnyConnections ? 'Reconnect' : source.action}
                  </a>
                ) : notifySubmitted[source.name] ? (
                  <p className="mt-4 text-sm font-semibold text-accent">Got it — we&apos;ll notify you when {source.name} is ready.</p>
                ) : (
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-ink/50">Get notified when {source.name} is available:</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={notifyEmails[source.name] || ''}
                        onChange={(e) => setNotifyEmails((prev) => ({ ...prev, [source.name]: e.target.value }))}
                        className="min-w-0 flex-1 rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => handleNotifySubmit(source.name)}
                        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper"
                      >
                        Notify me
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
