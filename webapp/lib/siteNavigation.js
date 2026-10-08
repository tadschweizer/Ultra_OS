const athleteTrainingItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/calendar', label: 'Training Calendar' },
  { href: '/races', label: 'Race Calendar' },
  { href: '/race-plan', label: 'Race Blueprint' },
  { href: '/check-in', label: 'Daily Check-in' },
  { href: '/log-intervention', label: 'Log Intervention' },
  { href: '/history', label: 'Intervention History' },
  { href: '/insights', label: 'Insights' },
  { href: '/progress', label: 'Progress' },
  { href: '/explorer', label: 'Explorer' },
];

const coachItems = [
  { href: '/coach-command-center', label: 'Coach Command Center' },
  { href: '/coach/training-calendar', label: 'Coach Calendar' },
  { href: '/messages', label: 'Coach Messages' },
  { href: '/coach/tools', label: 'Coach Tools' },
  { href: '/coach/groups', label: 'Coach Groups' },
];

const platformItems = [
  { href: '/messages', label: 'Messages' },
  { href: '/connections', label: 'Connections' },
  { href: '/content', label: 'Research' },
];

const supportSections = [
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

export const sidebarSections = [
  { title: 'Training', items: athleteTrainingItems },
  { title: 'Platform', items: platformItems },
  ...supportSections,
];

export function getSidebarSections(account = null) {
  const coachCapable = Boolean(account?.capabilities?.coach);
  const coachFirst = account?.primary_role === 'coach' && coachCapable;

  if (coachFirst) {
    return [
      { title: 'Coaching', items: coachItems },
      { title: 'My Training', items: athleteTrainingItems },
      { title: 'Platform', items: platformItems.filter((item) => item.href !== '/messages') },
      ...supportSections,
    ];
  }

  return [
    { title: 'Training', items: athleteTrainingItems },
    ...(coachCapable ? [{ title: 'Coaching', items: coachItems }] : []),
    { title: 'Platform', items: platformItems },
    ...supportSections,
  ];
}

export function getMobileTabs(account = null) {
  if (account?.primary_role === 'coach' && account?.capabilities?.coach) {
    return [
      { href: '/coach-command-center', label: 'Roster' },
      { href: '/coach/training-calendar', label: 'Calendar' },
      { href: '/messages', label: 'Messages' },
      { href: '/dashboard', label: 'Train' },
      { href: '/account', label: 'Profile' },
    ];
  }

  return [
    { href: '/dashboard', label: 'Today' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/calendar?log=1', label: 'Log workout', primary: true },
    { href: '/messages', label: 'Messages' },
    { href: '/settings', label: 'Profile' },
  ];
}

export const appMenuLinks = [
  ...new Map(
    [...sidebarSections, { title: 'Coaching', items: coachItems }]
      .flatMap((section) => section.items)
      .map((item) => [item.href, item])
  ).values(),
  { href: '/', label: 'Landing Page' },
];

export const appShellExcludedRoutes = [
  '/privacy', '/terms', '/support',
  '/',
  '/login',
  '/signup',
  '/pricing',
  '/guide',
  '/content/admin',
  '/onboarding',
  '/join',
  '/auth/callback',
];

export const protectedRoutes = [
  '/dashboard',
  '/calendar',
  '/coach/training-calendar',
  '/coach/tools',
  '/coach/groups',
  '/messages',
  '/races',
  '/race-plan',
  '/race-outcome',
  '/check-in',
  '/log-intervention',
  '/history',
  '/insights',
  '/progress',
  '/explorer',
  '/connections',
  '/coach-command-center',
  '/settings',
  '/account',
  '/notifications',
];

export function isCoachRoute(pathname = '') {
  return pathname === '/coach-command-center' || pathname.startsWith('/coach/');
}

export function getSidebarActiveHref(pathname = '') {
  if (pathname.startsWith('/interventions/')) return '/history';
  if (pathname.startsWith('/content/admin')) return '';
  return pathname;
}

export function buildMenuLinks(links = []) {
  const deduped = new Map();
  [...links, ...appMenuLinks].forEach((link) => {
    if (!deduped.has(link.href)) deduped.set(link.href, link);
  });
  return Array.from(deduped.values());
}
