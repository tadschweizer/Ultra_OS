import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import NavMenu from '../../../components/NavMenu';
import { appMenuLinks } from '../../../lib/siteNavigation';

export default function CoachAthleteDetail() {
  const router = useRouter();
  const { athleteId } = router.query;
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!athleteId) return;
    fetch(`/api/coach/athlete-detail?athlete_id=${athleteId}`).then((r) => r.json()).then(setData);
  }, [athleteId]);

  if (!data) return <main className="min-h-screen bg-paper p-6">Loading athlete detail…</main>;
  if (data.error) return <main className="min-h-screen bg-paper p-6">{data.error}</main>;

  return (
    <main className="min-h-screen bg-paper p-6 text-ink">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Coach Athlete Detail</p>
          <NavMenu label="Navigation" links={appMenuLinks} primaryLink={{ href: '/coach-command-center', label: 'Coach Home', variant: 'secondary' }} />
        </div>

        <section className="rounded-3xl border border-ink/10 bg-white p-6">
          <h1 className="text-3xl font-semibold">{data.athlete?.name}</h1>
          <p className="text-sm text-ink/60">{data.athlete?.email} · {data.athlete?.primary_sports?.join(', ') || 'No sport set'}</p>
          <p className="mt-2 text-sm">Risk: <strong className="uppercase">{data.riskLevel}</strong></p>
          <p className="text-sm text-ink/70">Suggested next action: {data.suggestedAction}</p>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-ink/10 bg-white p-5"><h2 className="font-semibold">Upcoming race</h2><p className="mt-2 text-sm">{data.upcomingRace ? `${data.upcomingRace.name} (${data.upcomingRace.event_date})` : 'No upcoming race'}</p></section>
          <section className="rounded-3xl border border-ink/10 bg-white p-5"><h2 className="font-semibold">Current protocols & compliance</h2>{data.compliance.length ? data.compliance.map((c) => <p key={c.id} className="mt-2 text-sm">{c.protocol_name}: {c.actual}% / target {c.target}%</p>) : <p className="mt-2 text-sm">No active protocols</p>}</section>
          <section className="rounded-3xl border border-ink/10 bg-white p-5"><h2 className="font-semibold">Recent interventions</h2>{data.interventions.slice(0,5).map((i) => <p key={i.id} className="mt-2 text-sm">{i.intervention_type || 'Intervention'} · {i.date || i.inserted_at?.slice(0,10)}</p>)}</section>
          <section className="rounded-3xl border border-ink/10 bg-white p-5"><h2 className="font-semibold">Recent workouts/activities</h2>{data.activities.slice(0,5).map((a) => <p key={a.id} className="mt-2 text-sm">{a.name || a.activity_type || 'Activity'} · {a.start_date?.slice(0,10)}</p>)}</section>
          <section className="rounded-3xl border border-ink/10 bg-white p-5"><h2 className="font-semibold">Recent check-ins</h2>{data.checkins.slice(0,5).map((c) => <p key={c.id} className="mt-2 text-sm">{c.created_at?.slice(0,10)} readiness: {c.readiness_score ?? '—'}</p>)}</section>
          <section className="rounded-3xl border border-ink/10 bg-white p-5"><h2 className="font-semibold">Coach notes</h2>{data.coachNotes.slice(0,5).map((n) => <p key={n.id} className="mt-2 text-sm">{n.created_at?.slice(0,10)} · {n.content}</p>)}</section>
        </div>
      </div>
    </main>
  );
}
