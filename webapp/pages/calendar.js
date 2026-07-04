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
      <div className="mx-auto max-w-7xl">
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

        {/* Compact header: keep the calendar itself above the fold */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] px-6 py-4">
          <div>
            <h1 className="font-display text-3xl leading-tight">Training Calendar</h1>
            <p className="mt-1 max-w-lg text-xs leading-5 text-ink/60">
              Planned workouts, completed sessions, and compliance — scroll for past and future months.
            </p>
          </div>
          {loadMetrics && (
            <div className="flex gap-2">
              {[
                { label: 'Fitness (CTL)', value: loadMetrics.chronic },
                { label: 'Fatigue (ATL)', value: loadMetrics.acute },
                { label: 'Form (TSB)', value: loadMetrics.form },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl border border-ink/10 bg-white/70 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink/50">{m.label}</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-ink">{m.value ?? '—'}</p>
                </div>
              ))}
              {loadStatus?.label && (
                <div className="rounded-2xl border border-ink/10 bg-white/70 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink/50">Status</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{loadStatus.label}</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-4">
          <TrainingCalendar role="athlete" />
        </section>
      </div>
    </main>
  );
}
