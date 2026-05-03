import { useRouter } from 'next/router';

const tabs = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`h-5 w-5 ${active ? 'text-ink' : 'text-ink/65'}`}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/log-intervention',
    label: 'Log',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`h-5 w-5 ${active ? 'text-ink' : 'text-ink/65'}`}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    primary: true,
  },
  {
    href: '/history',
    label: 'History',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`h-5 w-5 ${active ? 'text-ink' : 'text-ink/65'}`}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: '/content',
    label: 'Research',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`h-5 w-5 ${active ? 'text-ink' : 'text-ink/65'}`}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Profile',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`h-5 w-5 ${active ? 'text-ink' : 'text-ink/65'}`}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function MobileBottomNav() {
  const router = useRouter();
  const pathname = router.pathname;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-ink/8 bg-white/95 backdrop-blur lg:hidden">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href));

          if (tab.primary) {
            return (
              <a
                key={tab.href}
                href={tab.href}
                className="flex flex-1 flex-col items-center justify-center py-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink shadow-[0_4px_14px_rgba(19,24,22,0.22)]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-paper">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
                <span className="mt-1 text-[10px] font-semibold tracking-wide text-ink/60">{tab.label}</span>
              </a>
            );
          }

          return (
            <a
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center justify-center py-2"
            >
              {tab.icon(isActive)}
              <span className={`mt-1 text-[10px] font-semibold tracking-wide ${isActive ? 'text-ink' : 'text-ink/65'}`}>
                {tab.label}
              </span>
            </a>
          );
        })}
      </div>
      {/* Safe area spacer for phones with home indicator */}
      <div className="h-safe-area-inset-bottom bg-white/95" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </nav>
  );
}
