import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';

const accountRows = [
  { label: 'Email', value: 'Connected through current login flow' },
  { label: 'Password', value: 'Password-based auth not enabled yet' },
  { label: 'Connected Sources', value: 'Managed from Connections' },
  { label: 'Notifications', value: 'Email digests and alerts coming next' },
];

export default function AccountPage() {
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home' },
    { href: '/connections', label: 'Connections' },
    { href: '/log-intervention', label: 'Log Intervention' },
    { href: '/history', label: 'Intervention History' },
    { href: '/settings', label: 'Athlete Settings' },
    { href: '/account', label: 'Account Settings' },
    { href: '/content', label: 'Content' },
    { href: '/', label: 'Landing Page' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Account Settings</p>
          </div>
          <NavMenu
            label="Account settings navigation"
            links={navLinks}
            primaryLink={{ href: '/connections', label: 'Connections', variant: 'secondary' }}
          />
        </div>

        <DashboardTabs activeHref="/account" />

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Identity + Access</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">Account Settings</h1>
            </div>
            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Planned Scope</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/82">Password reset</div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/82">Email preferences</div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/82">Source permissions</div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/82">Export + privacy controls</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <div className="space-y-4">
              {accountRows.map((row) => (
                <div key={row.label} className="flex flex-col gap-2 rounded-[24px] bg-paper p-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm uppercase tracking-[0.2em] text-accent">{row.label}</p>
                  <p className="text-sm font-semibold text-ink">{row.value}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Next Build</p>
            <div className="mt-4 space-y-3 text-sm text-ink/78">
              <div className="rounded-[22px] bg-paper p-4">Move login from source-auth-only into first-party UltraOS auth.</div>
              <div className="rounded-[22px] bg-paper p-4">Add passwordless email login or OAuth account linking.</div>
              <div className="rounded-[22px] bg-paper p-4">Let users manage digest cadence, notifications, and data retention.</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
