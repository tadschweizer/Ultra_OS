import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import EmptyStateCard from '../components/EmptyStateCard';

const defaultSources = [
  {
    name: 'Strava',
    status: 'available',
    href: '/api/strava/login',
    action: 'Connect',
    enabled: true,
  },
  {
    name: 'Garmin',
    status: 'coming_soon',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
  {
    name: 'COROS',
    status: 'api_in_progress',
    href: '#',
    action: 'API access in progress',
    enabled: false,
    logoSrc: '/brand/coros-logo.png',
  },
  {
    name: 'Zwift',
    status: 'coming_soon',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
  {
    name: 'TrainingPeaks',
    status: 'coming_soon',
    href: '#',
    action: 'Coming soon',
    enabled: false,
  },
];

function getSourceStatusLabel(source = {}) {
  switch (source.status) {
    case 'connected':
      return 'Connected';
    case 'paused':
      return 'Paused';
    case 'error':
      return 'Needs attention';
    case 'revoked':
      return 'Reconnect needed';
    case 'available':
      return 'Available now';
    case 'api_in_progress':
      return 'API access in progress';
    case 'coming_soon':
    default:
      return 'Coming soon';
  }
}

export default function Connections() {
  const [athleteId, setAthleteId] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [sources, setSources] = useState(defaultSources);
  const [notifyEmails, setNotifyEmails] = useState({});
  const [notifySubmitted, setNotifySubmitted] = useState({});
  const navLinks = athleteId
    ? [
        { href: '/dashboard', label: 'Threshold Home', description: 'Insights, trends, and recent training.' },
        { href: '/connections', label: 'Connections', description: 'Manage linked training sources.' },
        { href: '/guide', label: 'Guide', description: 'Learn how connections fit into Threshold.' },
        { href: '/log-intervention', label: 'Log Intervention', description: 'Add a new intervention entry.' },
        { href: '/history', label: 'Intervention History', description: 'Review what you have logged.' },
        { href: '/settings', label: 'Settings', description: 'Adjust athlete baselines and zones.' },
        { href: '/content', label: 'Content', description: 'Track the content and community workstream.' },
        { href: '/', label: 'Landing Page', description: 'Return to the marketing/login surface.' },
      ]
    : [{ href: '/', label: 'Landing Page', description: 'Return to the Threshold entry page.' }];

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
      if (Array.isArray(data.connectionStatuses) && data.connectionStatuses.length) {
        setSources((current) =>
          current.map((source) => {
            const apiSource = data.connectionStatuses.find(
              (item) => item.id?.toLowerCase() === source.name.toLowerCase()
            );
            return apiSource
              ? {
                  ...source,
                  status: apiSource.status,
                  href: apiSource.href || source.href,
                  action: apiSource.actionLabel || source.action,
                  enabled: apiSource.id === 'strava',
                  lastSyncAt: apiSource.lastSyncAt || null,
                  lastError: apiSource.lastError || null,
                }
              : source;
          })
        );
      }
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
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold Connections</p>
          </div>
          <NavMenu
            label="Connections navigation"
            links={navLinks}
            primaryLink={athleteId ? { href: '/dashboard', label: 'Threshold Home' } : { href: '/', label: 'Landing Page', variant: 'secondary' }}
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
              body="Connect Strava to pull activity context into your intervention log. Garmin and COROS API access is in progress."
              ctaLabel="Add a Connection"
              ctaHref="/api/strava/login"
            />
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <article key={source.name} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <div className="flex items-center justify-between gap-3">
                {source.logoSrc ? (
                  <img
                    src={source.logoSrc}
                    alt={`${source.name} logo`}
                    className="h-7 max-w-[150px] object-contain object-left"
                  />
                ) : (
                  <p className="text-sm uppercase tracking-[0.22em] text-accent">{source.name}</p>
                )}
                <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">{getSourceStatusLabel(source)}</span>
              </div>
              {source.lastError ? (
                <p className="mt-2 text-xs text-red-600">{source.lastError}</p>
              ) : null}
              {source.name === 'Strava' && hasAnyConnections && (source.lastSyncAt || stravaLastSeen) ? (
                <p className="mt-2 text-xs text-ink/45">
                  Last synced: {new Date(source.lastSyncAt || stravaLastSeen).toLocaleString()}
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
                  <p className="mb-2 text-xs text-ink/50">
                    {source.status === 'api_in_progress'
                      ? `${source.name} API access is in progress. Get notified when it is ready:`
                      : `Get notified when ${source.name} is available:`}
                  </p>
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
      </div>
    </main>
  );
}
