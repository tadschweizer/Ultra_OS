import { useCallback, useEffect, useMemo, useState } from 'react';
import WeeklyPlanner from '../../components/WeeklyPlanner';
import { CoachReviewQueue } from '../../components/WorkoutReview';
import { useRouter } from 'next/router';
import NavMenu from '../../components/NavMenu';
import DashboardTabs from '../../components/DashboardTabs';
import TrainingCalendar from '../../components/TrainingCalendar';
import UpgradePrompt from '../../components/UpgradePrompt';
import EmptyStateCard from '../../components/EmptyStateCard';
import { useMe, usePlan } from '../../lib/planUtils';
import { appMenuLinks } from '../../lib/siteNavigation';

export default function CoachTrainingCalendarPage() {
  const router = useRouter();
  const { coachFeatures, planReady } = usePlan();
  const { me } = useMe();
  const [relationships, setRelationships] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError,setRosterError]=useState('');
  const [calendarVersion,setCalendarVersion]=useState(0);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');

  const loadRoster=useCallback(() => {
    if (!planReady || !coachFeatures) return;
    setRosterLoading(true);setRosterError('');
    fetch('/api/coach/relationships')
      .then((r) => {if(!r.ok)throw new Error('Roster unavailable');return r.json();})
      .then((d) => {
        const active = (d.relationships || []).filter((r) => r.status === 'active');
        setRelationships(active);
      })
      .catch(() => setRosterError('Could not load your athletes. Please retry.'))
      .finally(() => setRosterLoading(false));
  }, [planReady, coachFeatures]);
  useEffect(()=>{loadRoster();},[loadRoster]);

  // Preselect the athlete from ?athlete= (e.g. coming from the command center
  // drawer), otherwise the first active athlete on the roster.
  useEffect(() => {
    if (!relationships.length) return;
    const fromQuery = typeof router.query.athlete === 'string' ? router.query.athlete : '';
    const match = fromQuery && relationships.some((r) => r.athlete_id === fromQuery);
    setSelectedAthleteId(match ? fromQuery : relationships.some(r=>r.athlete_id===selectedAthleteId)?selectedAthleteId:relationships[0].athlete_id);
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
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold · Training Calendar</p>
            <NavMenu label="Navigation" links={appMenuLinks} primaryLink={{ href: '/dashboard', label: 'Home', variant: 'secondary' }} />
          </div>
          <section className="mt-12">
            <UpgradePrompt
              featureName="Coach Training Calendar"
              unlockTier="Coach Essentials or Coach Pro"
              body="Plan structured workouts on your athletes' calendars, track compliance, and build a reusable workout library on the Coach plan."
            />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-[1600px]">
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

        <section className="overflow-hidden rounded-[28px] border border-ink/10 bg-[linear-gradient(140deg,#1b2421_0%,#26332f_42%,#857056_100%)] px-6 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl leading-tight">Training Calendar</h1>
              <p className="mt-1 max-w-lg text-xs leading-5 text-white/65">
                Build structured workouts on each athlete&apos;s calendar — scroll for past and future months,
                click a day to add sessions, notes, or rest days.
              </p>
            </div>
            <div className="min-w-[240px]">
              <label className="mb-1 block text-xs uppercase tracking-[0.25em] text-white/60">Athlete</label>
              <select
                value={selectedAthleteId}
                onChange={(e) => {setSelectedAthleteId(e.target.value);const {workout,activity,...query}=router.query;router.replace({pathname:router.pathname,query:{...query,athlete:e.target.value}},undefined,{shallow:true,scroll:false});}}
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

        {!rosterError&&<WeeklyPlanner relationships={relationships} coachId={me?.account?.coach_profile?.id} onPublished={()=>setCalendarVersion(v=>v+1)}/>}
        <CoachReviewQueue key={`reviews-${calendarVersion}`}/>
        <section className="mt-6">
          {rosterLoading ? (
            <div className="rounded-[24px] border border-ink/10 bg-white p-8 text-center text-sm text-ink/55">
              Loading roster…
            </div>
          ) : rosterError ? <div role="alert" className="rounded border p-4"><p>{rosterError}</p><button onClick={loadRoster} className="mt-2 min-h-11 rounded border px-3">Retry roster</button></div> : !relationships.length ? (
            <EmptyStateCard
              icon="network"
              title="No active athletes yet."
              body="Invite athletes from the Coach Command Center, then plan their training here."
              ctaLabel="Open Command Center"
              ctaHref="/coach-command-center"
            />
          ) : selectedAthleteId ? (
            <TrainingCalendar
              key={`${selectedAthleteId}-${calendarVersion}`}
              role="coach"
              libraryOwnerId={me?.account?.coach_profile?.id || null}
              athleteId={selectedAthleteId}
              athleteName={selectedRelationship?.athlete?.name || ''}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
