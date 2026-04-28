import Link from 'next/link';
import { getCoachRaceReadinessPageData } from '../../../../lib/coachAnalytics';

function toneBadgeClasses(tone) {
  if (tone === 'green') return 'bg-emerald-100 text-emerald-900';
  if (tone === 'amber') return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-800';
}

function formatDate(value) {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntilLabel(value) {
  if (!value) return 'No race set';
  const target = new Date(value);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Race day';
  if (diff > 0) return `${diff} days to go`;
  return `${Math.abs(diff)} days ago`;
}

function ReadinessGauge({ value }) {
  const normalized = Math.min(100, Math.max(0, Number(value) || 0));
  const size = 260;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#D4893A"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/56">Race readiness</p>
        <p className="ui-data mt-4 text-6xl text-white">{normalized}</p>
        <p className="mt-2 text-sm text-white/62">Composite score</p>
      </div>
    </div>
  );
}

function BreakdownCard({ label, value, tone, detail }) {
  return (
    <article className="rounded-[24px] border border-border-subtle bg-white p-5 shadow-warm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">{label}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneBadgeClasses(tone)}`}>{value}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-light">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/58">{detail}</p>
    </article>
  );
}

export default function RaceReadinessPage({ initialData }) {
  if (!initialData) {
    return <main className="ui-shell"><div className="ui-card">Could not load race readiness.</div></main>;
  }

  if (!initialData.authorized) {
    return <main className="ui-shell"><div className="ui-card">That athlete is not in this coach roster.</div></main>;
  }

  const { readiness, athlete } = initialData;

  return (
    <main className="ui-shell text-ink">
      <div className="space-y-6">
        <section className="ui-card-dark overflow-hidden">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/coach/athletes/${athlete.id}`} className="rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-white/82">
                  Back to Athlete
                </Link>
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/82">
                  {readiness.groupName}
                </span>
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.28em] text-amber-300">Race readiness dashboard</p>
              <h1 className="font-display mt-3 text-4xl text-white md:text-5xl">{athlete?.name || 'Athlete'}</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
                One-screen readiness for the next race, weighted across compliance, consistency, training load, sleep, and gut progression.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">Upcoming race</p>
                  <p className="mt-2 text-lg font-semibold text-white">{readiness.upcomingRace?.name || 'No race linked'}</p>
                  <p className="mt-1 text-sm text-white/56">{readiness.upcomingRace?.race_type || 'Set a target race to sharpen readiness'}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">Countdown</p>
                  <p className="mt-2 text-lg font-semibold text-white">{daysUntilLabel(readiness.upcomingRace?.event_date)}</p>
                  <p className="mt-1 text-sm text-white/56">{formatDate(readiness.upcomingRace?.event_date)}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">Coach action load</p>
                  <p className="mt-2 text-lg font-semibold text-white">{readiness.actionItems.length} items</p>
                  <p className="mt-1 text-sm text-white/56">{readiness.risks.length ? `${readiness.risks.length} risk flags active` : 'No active risk flags'}</p>
                </div>
              </div>
            </div>

            <ReadinessGauge value={readiness.readinessScore} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
          <BreakdownCard label="Protocol Compliance" value={readiness.breakdown.protocolCompliance} tone={readiness.tones.protocolCompliance} detail="Average compliance against active race-linked protocols." />
          <BreakdownCard label="Intervention Consistency" value={readiness.breakdown.interventionConsistency} tone={readiness.tones.interventionConsistency} detail="Weeks with intervention logging over the last 28 days." />
          <BreakdownCard label="Training Load Trend" value={readiness.breakdown.trainingLoad} tone={readiness.tones.trainingLoad} detail="Recent 21-day load compared with the prior 21-day block." />
          <BreakdownCard label="Sleep Quality Trend" value={readiness.breakdown.sleepQuality} tone={readiness.tones.sleepQuality} detail="Recent sleep-protocol quality versus baseline sleep habits." />
          <BreakdownCard label="Gut Training Progress" value={readiness.breakdown.gutTraining} tone={readiness.tones.gutTraining} detail={`Current tolerance ${readiness.summaries.gutActual || 0} g/hr against target ${readiness.summaries.gutTarget || 0} g/hr.`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-6">
            <section className="ui-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Timeline</p>
                  <p className="mt-2 text-sm text-ink/58">Completed checkpoints versus what remains before race day.</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {readiness.timeline.length ? readiness.timeline.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 rounded-[20px] border border-border-subtle bg-surface-light px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.label}</p>
                      <p className="mt-1 text-sm text-ink/58">{formatDate(item.date)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.state === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                      {item.state === 'completed' ? 'Completed' : 'Remaining'}
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-ink/58">No readiness checkpoints are available until a race and protocols are linked.</p>
                )}
              </div>
            </section>

            <section className="ui-card">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Coach Action Items</p>
              <div className="mt-5 space-y-3">
                {readiness.actionItems.length ? readiness.actionItems.map((item) => (
                  <div key={item} className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-950">
                    {item}
                  </div>
                )) : (
                  <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                    No immediate coach interventions are suggested from the current data.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="ui-card">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Risk Flags</p>
              <div className="mt-5 space-y-3">
                {readiness.risks.length ? readiness.risks.map((risk) => (
                  <div key={risk} className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-4">
                    <p className="text-sm font-semibold text-red-800">{risk}</p>
                  </div>
                )) : (
                  <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                    No current readiness risks were detected from the last 90 days of data.
                  </div>
                )}
              </div>
            </section>

            <section className="ui-card">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Coach Notes</p>
              <div className="mt-5 space-y-3 text-sm text-ink/62">
                <p>Heat sessions in last 21 days: <span className="font-semibold text-ink">{readiness.summaries.recentHeatSessions}</span></p>
                <p>Sleep trend average: <span className="font-semibold text-ink">{readiness.summaries.recentSleepAvg || 'No sleep logs yet'}</span></p>
                <p>Recent intervention count: <span className="font-semibold text-ink">{readiness.summaries.recentInterventions}</span></p>
                <p>Load ratio: <span className="font-semibold text-ink">{readiness.summaries.loadRatio ? readiness.summaries.loadRatio.toFixed(2) : 'No activity data'}</span></p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

export async function getServerSideProps(context) {
  try {
    const athleteId = typeof context.params?.athleteId === 'string' ? context.params.athleteId : null;
    const data = await getCoachRaceReadinessPageData({ req: context.req, athleteId });

    if (!data.authenticated) {
      return {
        redirect: {
          destination: `/login?next=/coach/athletes/${athleteId}/race-readiness`,
          permanent: false,
        },
      };
    }

    return {
      props: {
        initialData: data,
      },
    };
  } catch (error) {
    console.error('[race readiness page] failed:', error);
    return {
      props: {
        initialData: null,
      },
    };
  }
}
