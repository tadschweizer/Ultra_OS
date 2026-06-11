import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import TrainingCalendar from '../components/TrainingCalendar';
import { useMe } from '../lib/planUtils';
import { appMenuLinks } from '../lib/siteNavigation';

export default function CalendarPage() {
  const { me } = useMe();
  const loadMetrics = me?.load_metrics || null;
  const loadStatus = me?.load_status || null;

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Training Calendar</p>
          <NavMenu label="Calendar navigation" links={appMenuLinks} primaryLink={{ href: '/dashboard', label: 'Home', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/calendar"
          tabs={[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/calendar', label: 'Training Calendar' },
            { href: '/history', label: 'Intervention History' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Plan · Execute · Review</p>
              <h1 className="font-display mt-4 text-5xl leading-tight md:text-6xl">Training Calendar</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-ink/65">
                Your planned workouts, completed sessions, and compliance in one place. Workouts assigned
                by your coach show up here automatically.
              </p>
            </div>
            {loadMetrics && (
              <div className="flex gap-3">
                {[
                  { label: 'Fitness (CTL)', value: loadMetrics.chronic },
                  { label: 'Fatigue (ATL)', value: loadMetrics.acute },
                  { label: 'Form (TSB)', value: loadMetrics.form },
                ].map((m) => (
                  <div key={m.label} className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50">{m.label}</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-ink">{m.value ?? '—'}</p>
                  </div>
                ))}
                {loadStatus?.label && (
                  <div className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50">Status</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{loadStatus.label}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6">
          <TrainingCalendar role="athlete" />
        </section>
      </div>
    </main>
  );
}
