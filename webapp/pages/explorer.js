import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';
import EmptyStateCard from '../components/EmptyStateCard';
import UpgradePrompt from '../components/UpgradePrompt';
import { usePlan } from '../lib/planUtils';
import { useEffect, useState } from 'react';

const inputVariables = ['Heat acclimation sessions', 'Gut training sessions', 'Sleep hours', 'Sleep quality', 'Daily carbs', 'Training load'];
const outcomeVariables = ['Race GI distress score', 'Race performance rating', 'Next-day perceived exertion', 'Next-day HRV', 'Next-day soreness', 'Race finish time'];
const chartPoints = [
  { left: '16%', bottom: '18%', label: 'May 4 · 2 heat sessions, HRV 58' },
  { left: '30%', bottom: '28%', label: 'June 2 · 3 heat sessions, HRV 61' },
  { left: '48%', bottom: '40%', label: 'July 10 · 4 heat sessions, HRV 64' },
  { left: '67%', bottom: '52%', label: 'August 1 · 5 heat sessions, HRV 66' },
  { left: '82%', bottom: '60%', label: 'September 6 · 6 heat sessions, HRV 68' },
];

export default function ExplorerPage() {
  const { explorerUnlocked, coachFeatures } = usePlan();
  const [loading, setLoading] = useState(true);
  const [interventionCount, setInterventionCount] = useState(0);
  const navLinks = [
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/insights', label: 'Insights' },
  ];

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/me');
        if (!res.ok) return;
        const data = await res.json();
        setInterventionCount(data.interventionCount || 0);
      } finally {
        setLoading(false);
      }
    }

    if (explorerUnlocked) {
      load();
    } else {
      setLoading(false);
    }
  }, [explorerUnlocked]);

  const showExplorerEmptyState = explorerUnlocked && !loading && interventionCount < 10;

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Explorer</p>
          <NavMenu label="Explorer navigation" links={navLinks} primaryLink={{ href: '/pricing', label: 'Pricing', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/explorer"
          tabs={[
            { href: '/explorer', label: 'Explorer' },
            { href: '/insights', label: 'Insights' },
            { href: '/guide', label: 'Guide' },
            { href: '/pricing', label: 'Pricing' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#eee7dc_0%,#d8c7b2_48%,#8e7354_100%)] p-6 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Self-Selection Explorer</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Explorer</h1>
        </section>

        {!explorerUnlocked ? (
          <section className="mt-12">
            {/* Show the real UI, blurred + overlaid, so athletes can see exactly what they're unlocking */}
            <div className="relative">
              <div className="pointer-events-none select-none blur-[3px]">
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-ink">Input variable</label>
                        <select className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink" disabled>
                          {inputVariables.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-ink">Outcome variable</label>
                        <select className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink" disabled>
                          {outcomeVariables.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                    <div className="relative h-[200px] rounded-[22px] bg-paper">
                      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full px-8 py-6">
                        <polyline fill="none" stroke="var(--color-accent-amber)" strokeWidth="1.6" points="15,76 29,64 47,52 66,40 81,32" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {chartPoints.map((point) => (
                        <div key={point.label} className="absolute" style={{ left: point.left, bottom: point.bottom }}>
                          <div className="h-4 w-4 rounded-full border-2 border-white bg-accent shadow-warm" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Upgrade overlay */}
              <div className="absolute inset-0 flex items-center justify-center rounded-[30px]">
                <div className="rounded-[28px] border border-ink/10 bg-white p-8 text-center shadow-[0_24px_60px_rgba(19,24,22,0.14)]">
                  <p className="text-sm uppercase tracking-[0.22em] text-accent">Explorer</p>
                  <p className="mt-3 text-xl font-semibold text-ink">Unlocks on Individual Annual or any Coach plan</p>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-ink/65">
                    Pick any input variable, any outcome, and see the relationship across your own history. Your data, your chart.
                  </p>
                  <a href="/pricing" className="mt-5 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper">
                    View plans &rarr;
                  </a>
                </div>
              </div>
            </div>
          </section>
        ) : showExplorerEmptyState ? (
          <section className="mt-12">
            <EmptyStateCard
              icon="spark"
              title="Nothing to explore yet."
              body="Your Explorer view populates as you log interventions and connect activities."
              ctaLabel="Log an Intervention"
              ctaHref="/log-intervention"
            />
          </section>
        ) : (
          <>
            <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-ink">Input variable</label>
                    <select className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink">
                      {inputVariables.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-ink">Outcome variable</label>
                    <select className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink">
                      {outcomeVariables.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold text-ink">Date range</label>
                  <select className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink">
                    <option>All time</option>
                  </select>
                </div>
                {coachFeatures ? (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-ink">View</label>
                    <div className="flex gap-2">
                      <button type="button" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">Individual athlete</button>
                      <button type="button" className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink">Cohort</button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="relative h-[320px] rounded-[22px] border border-ink/10 bg-paper">
                  <div className="absolute left-14 right-6 top-8 h-px bg-ink/10" />
                  <div className="absolute left-14 right-6 top-1/3 h-px bg-ink/10" />
                  <div className="absolute left-14 right-6 top-2/3 h-px bg-ink/10" />
                  <div className="absolute bottom-14 left-14 right-6 h-px bg-ink/18" />
                  <div className="absolute bottom-14 left-14 top-6 w-px bg-ink/18" />
                  <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full px-10 py-6">
                    <polyline
                      fill="none"
                      stroke="var(--color-accent-amber)"
                      strokeWidth="1.6"
                      points="15,76 29,64 47,52 66,40 81,32"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {chartPoints.map((point) => (
                    <div key={point.label} className="absolute" style={{ left: point.left, bottom: point.bottom }} title={point.label}>
                      <div className="h-4 w-4 rounded-full border-2 border-white bg-accent shadow-warm" />
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-ink/70">5 data points</p>
              </div>
            </section>

            <section className="mt-6 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <p className="text-sm leading-7 text-ink/76">
                Across these 5 data points, more completed heat sessions line up with higher next-day HRV rather than lower recovery.
              </p>
              <p className="mt-3 text-sm leading-7 text-ink/76">
                The relationship looks moderately positive, but the sample is still small enough that you should treat it as a working signal, not a settled rule.
              </p>
              <p className="mt-3 text-sm leading-7 text-ink/76">
                The practical read is that your heat block has not looked overly costly to recovery when you space it consistently.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
