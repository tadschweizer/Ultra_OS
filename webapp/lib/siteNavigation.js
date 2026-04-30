export const sidebarSections = [
  {
    title: 'Training',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/race-plan', label: 'Race Blueprint' },
      { href: '/log-intervention', label: 'Log Intervention' },
      { href: '/history', label: 'Intervention History' },
      { href: '/insights', label: 'Insights' },
      { href: '/explorer', label: 'Explorer' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { href: '/connections', label: 'Connections' },
      { href: '/coach-command-center', label: 'Coach Command Center' },
      { href: '/content', label: 'Research' },
    ],
  },
  {
    title: 'Help / Billing',
    items: [
      { href: '/guide', label: 'Guide' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/settings', label: 'Athlete Settings' },
      { href: '/account', label: 'Account Settings' },
      { href: '/notifications', label: 'Notifications' },
    ],
  },
];

export const appMenuLinks = [
  ...sidebarSections.flatMap((section) => section.items),
  { href: '/', label: 'Landing Page' },
];

export const appShellExcludedRoutes = ['/', '/content/admin', '/onboarding'];

export const protectedRoutes = [
  '/dashboard',
  '/race-plan',
  '/race-outcome',
  '/log-intervention',
  '/history',
  '/insights',
  '/explorer',
  '/connections',
  '/coach-command-center',
  '/settings',
  '/account',
  '/notifications',
];

export function getSidebarActiveHref(pathname = '') {
  if (pathname.startsWith('/interventions/')) return '/history';
  if (pathname.startsWith('/content/admin')) return '';
  return pathname;
}

export function buildMenuLinks(links = []) {
  const deduped = new Map();
  [...links, ...appMenuLinks].forEach((link) => {
    if (!deduped.has(link.href)) {
      deduped.set(link.href, link);
    }
  });
  return Array.from(deduped.values());
}
