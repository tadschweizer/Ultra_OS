import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';
import { coachDashboardSections, coachFlagExample, newCoachValue } from '../lib/insightSystemContent';

const coachFlags = [
  'Sarah M. - heat block 40% complete, 4 weeks to race.',
  'Evan R. - 10-day sleep average down to 5.9 hours, 17 days to race.',
  'Maya L. - recent 50K prep delivered lower GI distress after 4 gut sessions.',
];

const cohortRows = [
  { label: 'Roster sleep average', value: '6.6 hrs', note: 'Down 0.7 hrs vs prior 10 days' },
  { label: 'Athletes under fueling target', value: '2 of 3', note: 'Both are in build weeks' },
  { label: 'Protocols off-track', value: '2', note: 'Both still recoverable before race day' },
];

export default function CoachesPage() {
  const navLinks = [
    { href: '/', label: 'Landing Page' },
    { href: '/dashboard', label: 'UltraOS Home' },
    { href: '/insights', label: 'Insights System' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
  ];

  const tabs = [
    { href: '/coaches', label: 'Coaches' },
    { href: '/insights', label: 'Insights System' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Intervention' },
    { href: '/history', label: 'History' },
    { href: '/content', label: 'Research' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS For Coaches</p>
          </div>
          <NavMenu
            label="Coach page navigation"
            links={navLinks}
            primaryLink={{ href: '/insights', label: 'Open Insight System', variant: 'secondary' }}
          />
        </div>

        <DashboardTabs activeHref="/coaches" tabs={tabs} />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(140deg,#1b2421_0%,#26332f_42%,#857056_100%)] p-6 text-white md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Coach experience</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                One roster. One triage layer. Zero wasted check-ins.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-white/80 md:text-lg">
                Coaches should not have to read every athlete narrative to figure out who needs attention. The coach layer is built for flags, compliance, baseline drift, and fast drill-down into a specific athlete only when it matters.
              </p>
            </div>

            <div className="rounded-[34px] border border-white/10 bg-white/8 p-6 backdrop-blur">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Example coach flag</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-white">{coachFlagExample.headline}</h2>
              <p className="mt-4 text-sm leading-7 text-white/76">{coachFlagExample.body}</p>
              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/10 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-accent">Coach next step</p>
                <p className="mt-2 text-sm leading-7 text-white/84">{coachFlagExample.action}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {coachDashboardSections.map((item) => (
            <article key={item.title} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">Coach layer</p>
              <h2 className="mt-4 text-2xl font-semibold text-ink">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-ink/78">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Needs Attention Now</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">One-line flag format</span>
            </div>
            <div className="mt-5 space-y-3">
              {coachFlags.map((flag) => (
                <div key={flag} className="rounded-[22px] bg-paper px-4 py-4 text-sm font-semibold text-ink">
                  {flag}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Roster Cohort View</p>
              <span className="rounded-full border border-ink/10 bg-white/70 px-3 py-1 text-xs text-ink/70">First 3 athletes</span>
            </div>
            <div className="mt-5 grid gap-3">
              {cohortRows.map((row) => (
                <div key={row.label} className="rounded-[24px] border border-ink/10 bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{row.label}</p>
                    <p className="text-2xl font-semibold text-ink">{row.value}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink/72">{row.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Why a coach believes it is working in month one</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {newCoachValue.map((item) => (
              <div key={item.title} className="rounded-[24px] bg-paper p-4">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-ink/76">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
