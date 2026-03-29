const defaultTabs = [
  { href: '/guide', label: 'Guide' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/explorer', label: 'Explorer' },
  { href: '/insights', label: 'Insights' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/connections', label: 'Connections' },
  { href: '/log-intervention', label: 'Intervention' },
  { href: '/history', label: 'Intervention History' },
  { href: '/settings', label: 'Athlete Settings' },
  { href: '/account', label: 'Account Settings' },
  { href: '/content', label: 'Content' },
];

export default function DashboardTabs({ activeHref = '/dashboard', tabs = defaultTabs }) {
  if (activeHref === '/dashboard') {
    return null;
  }

  const activeTab = tabs.find((tab) => tab.href === activeHref);
  const activeLabel = activeTab?.label || 'Section';

  return (
    <div className="mb-8 lg:hidden">
      <div className="flex flex-wrap gap-3">
        <a
          href="/dashboard"
          className="ui-button-secondary bg-white/70 py-2"
        >
          Back to Home
        </a>
        <span className="ui-button-primary py-2">{activeLabel}</span>
      </div>
    </div>
  );
}
