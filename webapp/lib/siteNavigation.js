export const baseSidebarSections = [
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
      { href: '/messages', label: 'Messages' },
      { href: '/coach-command-center', label: 'Coach Command Center' },
      { href: '/content', label: 'Research' },
    ],
  },
  {
    title: 'Help / Billing',
    items: [
      { href: '/guide', label: 'Guide' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/support', label: 'Support' },
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

export const coachSidebarSection = {
  title: 'Coaching',
  items: [
    { href: '/coach/dashboard', label: 'Dashboard' },
    { href: '/coach/athletes', label: 'Athletes' },
    { href: '/coach/cohort', label: 'Cohort' },
    { href: '/coach/groups', label: 'Groups' },
    { href: '/coach/protocols', label: 'Protocols' },
    { href: '/coach/templates', label: 'Templates' },
    { href: '/coach/settings', label: 'Settings' },
  ],
};

export function buildSidebarSections({ hasCoachProfile = false } = {}) {
  return hasCoachProfile
    ? [coachSidebarSection, ...baseSidebarSections]
    : baseSidebarSections;
}

export const sidebarSections = baseSidebarSections;

export const appMenuLinks = [
  ...baseSidebarSections.flatMap((section) => section.items),
  { href: '/', label: 'Landing Page' },
];

export const publicRoutes = [
  '/',
  '/guide',
  '/pricing',
  '/support',
  '/content',
  '/login',
  '/signup',
  '/join',
  '/invite',
  '/auth/callback',
];

export const protectedRoutes = [
  '/dashboard',
  '/race-plan',
  '/race-outcome',
  '/log-intervention',
  '/history',
  '/insights',
  '/explorer',
  '/connections',
  '/messages',
  '/coach-command-center',
  '/settings',
  '/account',
  '/notifications',
  '/coach/dashboard',
  '/coach/athletes',
  '/coach/athletes/[athleteId]',
  '/coach/athletes/[athleteId]/race-readiness',
  '/coach/cohort',
  '/coach/groups',
  '/coach/protocols',
  '/coach/templates',
  '/coach/settings',
];

export const appShellRoutes = [
  ...protectedRoutes,
  '/admin',
  '/content/admin',
];

export function isProtectedRoutePath(pathname = '') {
  return protectedRoutes.includes(pathname) || pathname.startsWith('/interventions/');
}

export function shouldUseAppShell(pathname = '') {
  return appShellRoutes.includes(pathname) || pathname.startsWith('/interventions/');
}

export function isPublicRoutePath(pathname = '') {
  return publicRoutes.includes(pathname) || pathname.startsWith('/invite/');
}

export function getSidebarActiveHref(pathname = '') {
  if (pathname.startsWith('/interventions/')) return '/history';
  if (pathname.startsWith('/coach/athletes/')) return '/coach/athletes';
  if (pathname.startsWith('/coach/groups')) return '/coach/groups';
  if (pathname.startsWith('/coach/cohort')) return '/coach/cohort';
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
