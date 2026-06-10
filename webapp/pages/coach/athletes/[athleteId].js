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
  const [messages, setMessages] = useState([]);
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

    fetch(`/api/coach/messages?athlete_id=${athleteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload?.messages) setMessages(payload.messages.slice(-3));
      })
      .catch(() => {});
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
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/messages?athlete_id=${athleteId}`}
              className="rounded-full bg-panel px-4 py-2 text-xs font-semibold text-paper transition hover:opacity-85"
            >
              Message athlete →
            </a>
            <a
              href="/coach-command-center"
              className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink/75 transition hover:bg-paper"
            >
              Assign protocol / add note
            </a>
          </div>
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

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-ink/10 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Coach notes</h2>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/55">{(data.coachNotes || []).length} recent</span>
            </div>
            {(data.coachNotes || []).length ? (
              <div className="mt-4 space-y-3">
                {data.coachNotes.slice(0, 5).map((note) => (
                  <article key={note.id} className={`rounded-2xl border p-3 ${note.is_pinned ? 'border-accent/30 bg-accent/5' : 'border-ink/10 bg-paper'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/55">
                        {note.note_type}{note.is_pinned ? ' · pinned' : ''}
                      </span>
                      <span className="text-xs text-ink/40">{note.created_at ? new Date(note.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/80">{note.content}</p>
                    {note.share_with_athlete ? (
                      <p className="mt-1.5 text-[11px] text-ink/45">
                        Shared with athlete{note.athlete_read_at ? ' · read' : ' · unread'}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink/60">No notes yet. Add observations from the Command Center drawer so decisions have a paper trail.</p>
            )}
          </div>

          <div className="rounded-3xl border border-ink/10 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Recent messages</h2>
              <a href={`/messages?athlete_id=${athleteId}`} className="text-xs font-semibold text-accent hover:underline">
                Open conversation →
              </a>
            </div>
            {messages.length ? (
              <div className="mt-4 space-y-3">
                {messages.map((m) => (
                  <article key={m.id} className={`rounded-2xl border p-3 ${m.sender_role === 'coach' ? 'border-accent/20 bg-accent/5' : 'border-ink/10 bg-paper'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/55">{m.sender_role}</span>
                      <span className="text-xs text-ink/40">{m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/80">{m.message_body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink/60">No messages yet. A check-in tied to the suggested action above is a good first touch.</p>
            )}
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
