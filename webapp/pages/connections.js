import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import EmptyStateCard from '../components/EmptyStateCard';
import { clearMe, fetchMe } from '../lib/meClient';

const sources = ['Garmin', 'COROS', 'Oura', 'Ultrahuman', 'Zwift', 'TrainingPeaks', 'CORE Body Temp'];

export default function Connections() {
  const [athleteId, setAthleteId] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [availability, setAvailability] = useState({ strava: false });
  const [notifyEmails, setNotifyEmails] = useState({});
  const [notifyStatus, setNotifyStatus] = useState({});
  const [stravaStatus, setStravaStatus] = useState(null);
  const [stravaBusy, setStravaBusy] = useState(null);
  const [stravaNotice, setStravaNotice] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
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
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (!cancelled && data?.athlete?.id) setAthleteId(data.athlete.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function loadAthlete() {
      const data = await fetchMe();
      setAthlete(data?.athlete || null);
    }

    if (athleteId) {
      loadAthlete();
    }
  }, [athleteId]);

  const hasAnyConnections = stravaStatus?.connected ?? Boolean(athlete?.strava_id);
  useEffect(() => {
    if (!athleteId) return;
    const abort = new AbortController();
    fetch('/api/strava/connection', { signal: abort.signal }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error('Connection status could not be loaded. Refresh this page to try again.');
      if (typeof data.connected === 'boolean') setStravaStatus(data);
    }).catch(error => { if (error.name !== 'AbortError') setStravaNotice(error.message); });
    return () => abort.abort();
  }, [athleteId]);
  useEffect(() => {
    fetch('/api/integrations/status').then((res) => res.ok ? res.json() : {})
      .then((data) => setAvailability({ strava: data.strava === true })).catch(() => {});
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'strava_permissions') {
      setStravaNotice('Strava activity access was not granted. Connect again and allow activity access to import training.');
    }
  }, []);

  const visibleSources = [
    { name: 'Strava', enabled: availability.strava, href: '/api/strava/login',
      status: hasAnyConnections ? 'Connected' : availability.strava ? 'Available now' : 'Currently unavailable' },
    ...sources.map((name) => ({ name, enabled: false, status: 'Coming soon' })),
  ];

  async function manageStrava(action) {
    if (stravaBusy) return;
    setStravaBusy(action); setStravaNotice('');
    try {
      const response = await fetch('/api/strava/connection', {
        method: action === 'disconnect' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'disconnect' ? { confirm: 'DISCONNECT STRAVA' } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Strava could not be updated. Try again.');
      if (action === 'disconnect') {
        clearMe(); setAthlete(current => current ? { ...current, strava_id: null } : current);
        setStravaStatus({ connected: false }); setConfirmDisconnect(false);
        setStravaNotice(data.providerCleanup === 'failed'
          ? 'Imported activities were removed from Threshold. Also revoke Threshold in Strava’s My Apps settings to finish disconnecting.'
          : 'Strava disconnected. Imported activities were removed; your manual training is unchanged.');
      } else {
        setStravaStatus(data);
        const reason = data.sync?.reason;
        setStravaNotice(data.sync?.message || (reason === 'in_progress' ? 'An import is already running. Check back shortly.'
          : reason === 'retry_later' ? 'Strava requests are paused briefly. Try again shortly.'
          : reason === 'throttled' ? 'Activities were checked recently. Try again shortly.'
          : reason === 'not_connected' ? 'Connect Strava to import activities.'
          : reason === 'source_deleted' ? 'An activity was removed in Strava. Your next import will refresh the remaining training.'
          : `${data.sync?.synced || 0} ${(data.sync?.synced || 0) === 1 ? 'activity' : 'activities'} refreshed. Your calendar and coach views use the same saved training.`));
      }
    } catch (error) { setStravaNotice(error.message || 'Network error. Try again.'); }
    finally { setStravaBusy(null); }
  }

  async function handleNotifySubmit(sourceName) {
    const email = (notifyEmails[sourceName] || '').trim();
    if (!email) {
      setNotifyStatus((prev) => ({ ...prev, [sourceName]: { ok: false, message: 'Please enter an email address.' } }));
      return;
    }

    try {
      const response = await fetch('/api/integration-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceName, email }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotifyStatus((prev) => ({ ...prev, [sourceName]: { ok: false, message: payload.error || 'Unable to save interest.' } }));
        return;
      }

      setNotifyStatus((prev) => ({
        ...prev,
        [sourceName]: {
          ok: true,
          message: payload.message || `Got it — we'll notify you when ${sourceName} is ready.`,
        },
      }));
    } catch (error) {
      setNotifyStatus((prev) => ({ ...prev, [sourceName]: { ok: false, message: 'Network error. Please try again.' } }));
    }
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
          <section className="mb-6">
            <EmptyStateCard icon="network" title="No connections yet."
              body="You can log training manually. Connect Strava when it is available; other integrations are coming soon."
              ctaLabel="Log training" ctaHref="/log-intervention" />
          </section>
        ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleSources.map((source) => (
              <article key={source.name} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm uppercase tracking-[0.22em] text-accent">{source.name}</p>
                  <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">
                    {source.status}
                  </span>
                </div>
                {source.name === 'Strava' && hasAnyConnections ? (
                  <div className="mt-4 space-y-3 text-sm text-ink/75">
                    <p>{stravaStatus?.lastSyncedAt ? `Last successful import: ${new Date(stravaStatus.lastSyncedAt).toLocaleString()}` : 'No successful import yet.'}</p>
                    {stravaStatus ? <p>{stravaStatus.activityCount || 0} imported {(stravaStatus.activityCount || 0) === 1 ? 'activity' : 'activities'}</p> : null}
                    {stravaStatus?.message ? <p className="text-amber-800">{stravaStatus.message}</p> : null}
                    <div className="flex flex-wrap gap-3">
                      <button type="button" disabled={Boolean(stravaBusy) || !availability.strava} onClick={() => manageStrava('sync')}
                        className="rounded-full border border-ink/20 px-4 py-3 font-semibold disabled:opacity-50">{stravaBusy === 'sync' ? 'Importing…' : 'Sync activities'}</button>
                      <button type="button" disabled={Boolean(stravaBusy) || !stravaStatus} onClick={() => setConfirmDisconnect(true)}
                        className="rounded-full border border-ink/20 px-4 py-3 font-semibold disabled:opacity-50">Disconnect Strava</button>
                    </div>
                    {confirmDisconnect ? <div className="rounded-2xl border border-ink/15 bg-paper p-4">
                      <p className="font-semibold">Remove imported Strava training?</p>
                      <p className="mt-2">Disconnecting removes imported Strava activities and their comments from Threshold. Manually entered workouts and training stay.</p>
                      {stravaStatus?.canDisconnect === false ? <p className="mt-2">Add an email or Google sign-in first so you can still access your account.</p> : null}
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button type="button" disabled={Boolean(stravaBusy)} onClick={() => setConfirmDisconnect(false)} className="rounded-full border border-ink/20 px-4 py-3">Keep connection</button>
                        <button type="button" disabled={Boolean(stravaBusy) || !stravaStatus?.canDisconnect} onClick={() => manageStrava('disconnect')}
                          className="rounded-full bg-ink px-4 py-3 font-semibold text-paper disabled:opacity-50">{stravaBusy === 'disconnect' ? 'Disconnecting…' : 'Confirm disconnect'}</button>
                      </div>
                    </div> : null}
                    <a href="https://www.strava.com/settings/apps" target="_blank" rel="noreferrer" className="inline-block font-semibold underline">Manage access in Strava</a>
                  </div>
                ) : null}
                {source.name === 'Strava' && stravaNotice ? <p role="status" aria-live="polite" className="mt-4 text-sm text-ink/80">{stravaNotice}</p> : null}
                {source.enabled ? (
                  <a href={source.href} className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
                    {source.name === 'Strava' && hasAnyConnections ? 'Reconnect' : 'Connect'}
                  </a>
                ) : (
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-ink/50">Get notified when {source.name} is available:</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        aria-label={`${source.name} notification email`}
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
                    {notifyStatus[source.name] ? (
                      <p className={`mt-3 text-sm font-semibold ${notifyStatus[source.name].ok ? 'text-accent' : 'text-red-700'}`}>
                        {notifyStatus[source.name].message}
                      </p>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
          </section>
      </div>
    </main>
  );
}
