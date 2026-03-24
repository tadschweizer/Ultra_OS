import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import { buildProtocolSummary } from '../lib/interventionCatalog';

function formatRaceSummary(race) {
  if (!race) return 'No saved race profile';
  const parts = [];
  if (race.event_date) parts.push(race.event_date);
  if (race.location) parts.push(race.location);
  if (race.distance_miles) parts.push(`${Number(race.distance_miles).toFixed(1)} mi`);
  return parts.join(' - ') || 'Saved race profile';
}

export default function History() {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/settings', label: 'Settings', description: 'Edit baselines and zones.' },
    { href: '/content', label: 'Content', description: 'Track the content and community workstream.' },
    { href: '/', label: 'Landing Page', description: 'Return to the public entry page.' },
  ];

  useEffect(() => {
    async function fetchInterventions() {
      try {
        const res = await fetch('/api/interventions');
        if (res.ok) {
          const data = await res.json();
          setInterventions(data.interventions);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchInterventions();
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS History</p>
          </div>
          <NavMenu
            label="History navigation"
            links={navLinks}
            primaryLink={{ href: '/log-intervention', label: 'Log Intervention' }}
          />
        </div>

        <DashboardTabs activeHref="/history" />

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Most Recent First</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Review the intervention stack, not just the workouts.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                History should answer what you tried, when you tried it, what race it was tied to,
                and how it felt. The newest entries stay on top so the page is useful during an active build.
              </p>
            </div>
            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Current Log State</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Entries</p>
                  <p className="mt-2 text-2xl font-semibold">{interventions.length}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Default Sort</p>
                  <p className="mt-2 text-2xl font-semibold">Newest</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {interventions.length === 0 ? (
          <div className="rounded-[30px] border border-ink/10 bg-white p-6">
            <p className="text-sm text-ink/70">No interventions logged yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {interventions.map((item) => (
              <a
                key={item.id}
                href={`/interventions/${item.id}`}
                className="block rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-accent">
                      {item.date || 'Date not set'}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">
                      {item.intervention_type || 'Intervention'}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm font-medium text-ink/75">
                      {buildProtocolSummary(item.intervention_type, item.protocol_payload)}
                    </p>
                    <p className="mt-2 text-sm text-ink/65">
                      {item.races?.name || item.target_race || 'No target race'}
                    </p>
                    <p className="mt-1 text-sm text-ink/55">{formatRaceSummary(item.races)}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[20px] bg-paper px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">GI</p>
                      <p className="mt-1 text-lg font-semibold">{item.gi_response ?? '-'}</p>
                    </div>
                    <div className="rounded-[20px] bg-paper px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Physical</p>
                      <p className="mt-1 text-lg font-semibold">{item.physical_response ?? '-'}</p>
                    </div>
                    <div className="rounded-[20px] bg-paper px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Feel</p>
                      <p className="mt-1 text-lg font-semibold">{item.subjective_feel ?? '-'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-ink/65">
                  <span className="rounded-full bg-paper px-3 py-2">
                    Activity {item.activity_id || 'none'}
                  </span>
                  <span className="rounded-full bg-paper px-3 py-2">
                    Race date {item.target_race_date || item.races?.event_date || 'not set'}
                  </span>
                  <span className="rounded-full bg-paper px-3 py-2">
                    Elevation {item.races?.elevation_gain_ft ? `${item.races.elevation_gain_ft.toLocaleString()} ft` : 'n/a'}
                  </span>
                  <span className="rounded-full bg-paper px-3 py-2">
                    Open to edit
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
