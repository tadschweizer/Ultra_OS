import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import NavMenu from '../../components/NavMenu';
import DashboardTabs from '../../components/DashboardTabs';
import TrainingCalendar from '../../components/TrainingCalendar';
import UpgradePrompt from '../../components/UpgradePrompt';
import EmptyStateCard from '../../components/EmptyStateCard';
import { usePlan } from '../../lib/planUtils';
import { appMenuLinks } from '../../lib/siteNavigation';

export default function CoachTrainingCalendarPage() {
  const router = useRouter();
  const { coachFeatures, planReady } = usePlan();
  const [relationships, setRelationships] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');

  useEffect(() => {
    if (!planReady || !coachFeatures) return;
    fetch('/api/coach/relationships')
      .then((r) => (r.ok ? r.json() : { relationships: [] }))
      .then((d) => {
        const active = (d.relationships || []).filter((r) => r.status === 'active');
        setRelationships(active);
      })
      .catch(() => {})
      .finally(() => setRosterLoading(false));
  }, [planReady, coachFeatures]);

  // Preselect the athlete from ?athlete= (e.g. coming from the command center
  // drawer), otherwise the first active athlete on the roster.
  useEffect(() => {
    if (selectedAthleteId || !relationships.length) return;
    const fromQuery = typeof router.query.athlete === 'string' ? router.query.athlete : '';
    const match = fromQuery && relationships.some((r) => r.athlete_id === fromQuery);
    setSelectedAthleteId(match ? fromQuery : relationships[0].athlete_id);
  }, [relationships, router.query.athlete, selectedAthleteId]);

  const selectedRelationship = useMemo(
    () => relationships.find((r) => r.athlete_id === selectedAthleteId) || null,
    [relationships, selectedAthleteId]
  );

  if (!planReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-ink/55">Loading Training Calendar…</p>
      </main>
    );
  }

  if (!coachFeatures) {
    return (
      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold · Training Calendar</p>
            <NavMenu label="Navigation" links={appMenuLinks} primaryLink={{ href: '/dashboard', label: 'Home', variant: 'secondary' }} />
          </div>
          <section className="mt-12">
            <UpgradePrompt
              featureName="Coach Training Calendar"
              unlockTier="Coach Monthly or Coach Annual"
              body="Plan structured workouts on your athletes' calendars, track compliance, and build a reusable workout library on the Coach plan."
            />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold · Training Calendar</p>
          <NavMenu label="Navigation" links={appMenuLinks} primaryLink={{ href: '/coach-command-center', label: 'Command Center', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/coach/training-calendar"
          tabs={[
            { href: '/coach-command-center', label: 'Coach Command Center' },
            { href: '/coach/training-calendar', label: 'Training Calendar' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(140deg,#1b2421_0%,#26332f_42%,#857056_100%)] p-6 text-white md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Plan the work</p>
              <h1 className="font-display mt-4 text-5xl leading-tight md:text-6xl">Training Calendar</h1>
              <p className="mt-3 max-w-lg text-white/65">
                Build structured workouts on each athlete&apos;s calendar, reuse sessions from your
                library, and see planned-versus-completed compliance at a glance.
              </p>
            </div>
            <div className="min-w-[240px]">
              <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-white/60">Athlete</label>
              <select
                value={selectedAthleteId}
                onChange={(e) => setSelectedAthleteId(e.target.value)}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white backdrop-blur [&>option]:text-ink"
              >
                {!relationships.length && <option value="">No active athletes</option>}
                {relationships.map((rel) => (
                  <option key={rel.athlete_id} value={rel.athlete_id}>
                    {rel.athlete?.name || 'Athlete'}
                  </option>
                ))}
              </select>
              {selectedRelationship?.group_name && (
                <p className="mt-2 text-xs text-white/55">Group: {selectedRelationship.group_name}</p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6">
          {rosterLoading ? (
            <div className="rounded-[24px] border border-ink/10 bg-white p-8 text-center text-sm text-ink/55">
              Loading roster…
            </div>
          ) : !relationships.length ? (
            <EmptyStateCard
              icon="network"
              title="No active athletes yet."
              body="Invite athletes from the Coach Command Center, then plan their training here."
              ctaLabel="Open Command Center"
              ctaHref="/coach-command-center"
            />
          ) : selectedAthleteId ? (
            <TrainingCalendar key={selectedAthleteId} role="coach" athleteId={selectedAthleteId} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
