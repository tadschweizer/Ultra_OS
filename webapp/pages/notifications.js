import DashboardTabs from '../components/DashboardTabs';
import NavMenu from '../components/NavMenu';
import FeatureComingSoon from '../components/FeatureComingSoon';

export default function NotificationsPage() {
  const navLinks = [
    { href: '/dashboard', label: 'Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/settings', label: 'Settings' },
    { href: '/account', label: 'Account' },
  ];

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Notifications</p>
          <NavMenu label="Notifications navigation" links={navLinks} primaryLink={{ href: '/settings', label: 'Settings', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/notifications"
          tabs={[
            { href: '/guide', label: 'Guide' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/notifications', label: 'Notifications' },
            { href: '/settings', label: 'Settings' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#f3ebdf_0%,#d8cab4_48%,#987c5a_100%)] p-6 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Notifications</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Notification preferences</h1>
        </section>

        <section className="mt-12">
          <FeatureComingSoon title="Notifications" />
        </section>
      </div>
    </main>
  );
}
