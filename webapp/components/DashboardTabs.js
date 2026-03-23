const defaultTabs = [
  { href: '/connections', label: 'Connections' },
  { href: '/log-intervention', label: 'Intervention' },
  { href: '/history', label: 'Intervention History' },
  { href: '/settings', label: 'Athlete Settings' },
  { href: '/account', label: 'Account Settings' },
  { href: '/content', label: 'Content' },
];

export default function DashboardTabs({ activeHref = '/dashboard', tabs = defaultTabs }) {
  return (
    <div className="mb-8 ml-2 md:ml-12">
      <div className="flex flex-wrap gap-3">
        <a
          href="/dashboard"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeHref === '/dashboard'
              ? 'bg-ink text-paper'
              : 'border border-ink/10 bg-white/70 text-ink hover:bg-white'
          }`}
        >
          Home
        </a>
        {tabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeHref === tab.href
                ? 'bg-ink text-paper'
                : 'border border-ink/10 bg-white/70 text-ink hover:bg-white'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </div>
  );
}
