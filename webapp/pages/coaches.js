import { useEffect } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';

const CLASSIC_RETIREMENT_DATE = 'June 30, 2026';

export default function CoachesPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const timer = window.setTimeout(() => {
        window.location.assign('/coach-command-center');
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  const navLinks = [
    { href: '/', label: 'Landing Page' },
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/coach-command-center', label: 'Coach Command Center' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold Coach</p>
          <NavMenu label="Coach navigation" links={navLinks} primaryLink={{ href: '/coach-command-center', label: 'Open Command Center', variant: 'secondary' }} />
        </div>

        <DashboardTabs activeHref="/coaches" tabs={[{ href: '/coach-command-center', label: 'Coach Command Center' }, { href: '/coaches', label: 'Classic View (Redirecting)' }]} />

        <section className="rounded-[32px] border border-ink/10 bg-white p-8 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Classic coach view</p>
          <h1 className="font-display mt-4 text-4xl leading-tight md:text-5xl">We moved coach workflows.</h1>
          <p className="mt-4 text-base leading-8 text-ink/80">
            Redirecting you to the Coach Command Center now. Classic view retiring on {CLASSIC_RETIREMENT_DATE}.
          </p>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-ink/78">
            <li>Triage now lives in <strong>Roster + Triage</strong>.</li>
            <li>Roster management now lives in <strong>Roster + Triage</strong>.</li>
            <li>Protocol assignment now lives in <strong>Protocol Assignment</strong>.</li>
            <li>Notes and templates now live in <strong>Notes &amp; Templates</strong>.</li>
          </ul>
          <a href="/coach-command-center" className="mt-6 inline-flex rounded-full bg-panel px-5 py-2.5 text-sm font-semibold text-paper">
            Go to Coach Command Center
          </a>
        </section>
      </div>
    </main>
  );
}
