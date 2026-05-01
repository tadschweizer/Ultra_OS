import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../../../components/NavMenu';
import { appMenuLinks } from '../../../lib/siteNavigation';

const statusTone = {
  red: 'bg-red-100 text-red-800 border-red-200',
  yellow: 'bg-amber-100 text-amber-800 border-amber-200',
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export default function CoachAthleteDetail() {
  const router = useRouter();
  const { athleteId } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!athleteId) return;
    setLoading(true);
    setError('');
    fetch(`/api/coach/athlete-detail?athlete_id=${athleteId}`)
      .then((r) => r.json())
      .then((payload) => {
        if (payload.error) setError(payload.error);
        setData(payload);
      })
      .catch(() => setError('Could not load athlete report. Please refresh and try again.'))
      .finally(() => setLoading(false));
  }, [athleteId]);

  const confidenceClass = useMemo(() => {
    const confidence = data?.raceReadiness?.confidence || 'low';
    return confidence === 'high' ? 'text-emerald-700' : confidence === 'medium' ? 'text-amber-700' : 'text-red-700';
  }, [data]);

  if (loading) return <main className="min-h-screen bg-paper p-6 text-ink">Loading coach race-readiness report…</main>;
  if (error) return <main className="min-h-screen bg-paper p-6 text-red-700">{error}</main>;
  if (!data?.athlete) return <main className="min-h-screen bg-paper p-6 text-ink">Athlete record not found.</main>;

  const readiness = data.raceReadiness || {};

  return (
    <main className="min-h-screen bg-paper p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Coach Athlete Detail</p>
          <NavMenu label="Navigation" links={appMenuLinks} primaryLink={{ href: '/coach-command-center', label: 'Coach Command Center', variant: 'secondary' }} />
        </div>

        <section className="rounded-3xl border border-ink/10 bg-white p-5 sm:p-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">{data.athlete.name}</h1>
          <p className="text-sm text-ink/60">{data.athlete.email} · {data.athlete.primary_sports?.join(', ') || 'No sport set'}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusTone[data.riskLevel] || statusTone.yellow}`}>Readiness {data.riskLevel}</span>
            <span className={`text-sm font-semibold uppercase ${confidenceClass}`}>Confidence: {readiness.confidence || 'low'}</span>
          </div>
          <p className="mt-3 text-sm text-ink/80">Suggested next action: {readiness.suggestedAction || data.suggestedAction}</p>
        </section>

        <section className="mt-6 rounded-3xl border border-ink/10 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Race readiness report</h2>
          <p className="mt-1 text-xs text-ink/55">For coaching support only. This summary does not provide medical advice or diagnosis.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Days until race" value={readiness.daysUntilRaceLabel || 'No upcoming race'} />
            <Card title="Current protocols" value={readiness.protocolSummary || 'No active protocols'} />
            <Card title="Protocol compliance" value={readiness.complianceSummary || 'No compliance data yet'} />
            <Card title="Missing data" value={(readiness.missingData || []).join(', ') || 'None'} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-ink/10 bg-paper p-4">
              <h3 className="font-semibold">Readiness domains</h3>
              {(readiness.domains || []).length ? readiness.domains.map((d) => <p key={d.name} className="mt-2 text-sm"><strong>{d.name}:</strong> {d.status} ({d.note})</p>) : <p className="mt-2 text-sm text-ink/60">Not enough data yet to score readiness domains.</p>}
            </section>
            <section className="rounded-2xl border border-ink/10 bg-paper p-4">
              <h3 className="font-semibold">Recent workout + check-in signals</h3>
              {(readiness.signals || []).length ? readiness.signals.map((s, idx) => <p key={`${s}-${idx}`} className="mt-2 text-sm">• {s}</p>) : <p className="mt-2 text-sm text-ink/60">No recent signal data available.</p>}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-4">
      <p className="text-xs uppercase tracking-wide text-ink/60">{title}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
