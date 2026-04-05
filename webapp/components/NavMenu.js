import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

// Items already covered by the bottom nav — skip in the sheet to avoid redundancy
const BOTTOM_NAV_HREFS = new Set(['/dashboard', '/log-intervention', '/history', '/content', '/settings']);

const sheetSections = [
  {
    title: 'Training',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 stroke-accent" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 10h3l2-6 3 12 2-8 2 4h4" />
      </svg>
    ),
    items: [
      { href: '/insights', label: 'Insights', description: 'N=1 correlations from your data' },
      { href: '/race-plan', label: 'Race Blueprint', description: 'Plan your next race' },
      { href: '/race-outcome', label: 'Race Debrief', description: 'Log a completed race' },
      { href: '/explorer', label: 'Explorer', description: 'Browse all activities' },
    ],
  },
  {
    title: 'Platform',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 stroke-accent" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v4l3 3" />
      </svg>
    ),
    items: [
      { href: '/connections', label: 'Connections', description: 'Strava and data sources' },
      { href: '/coaches', label: 'Coaches', description: 'Find a coach' },
      { href: '/notifications', label: 'Notifications', description: 'Alerts and updates' },
    ],
  },
  {
    title: 'Account',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 stroke-accent" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 17v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
        <circle cx="10" cy="7" r="3" />
      </svg>
    ),
    items: [
      { href: '/account', label: 'Account Settings', description: 'Email, billing, security' },
      { href: '/guide', label: 'Guide', description: 'How Threshold works' },
      { href: '/pricing', label: 'Pricing', description: 'Plans and upgrades' },
    ],
  },
];

export default function NavMenu({ primaryLink = null }) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  // Fetch admin status once on mount
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.athlete?.is_admin) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  // Lock body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [router.pathname]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative lg:hidden">
      <div className="flex items-center gap-3">
        {primaryLink ? (
          <a
            href={primaryLink.href}
            className={primaryLink.variant === 'secondary' ? 'ui-button-secondary py-2' : 'ui-button-primary py-2'}
          >
            {primaryLink.label}
          </a>
        ) : null}

        {/* Trigger button — morphs between hamburger and × */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-pill border border-ink/10 bg-white/70 text-ink backdrop-blur transition"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {/* Admin badge dot */}
          {isAdmin && !open ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-bold text-white shadow-sm">
              A
            </span>
          ) : null}
          {open ? (
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 stroke-ink" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </svg>
          ) : (
            <span className="flex flex-col gap-[4.5px]">
              <span className="block h-[2px] w-5 rounded bg-current" />
              <span className="block h-[2px] w-3.5 rounded bg-current" />
              <span className="block h-[2px] w-5 rounded bg-current" />
            </span>
          )}
        </button>
      </div>

      {/* Backdrop — tap to dismiss */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Slide-up bottom sheet */}
      <div
        aria-hidden={!open}
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out lg:hidden ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="rounded-t-[32px] bg-white shadow-[0_-8px_40px_rgba(19,24,22,0.18)]">
          {/* Drag handle */}
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1 w-10 rounded-full bg-ink/15" />
          </div>

          {/* Sheet header */}
          <div className="flex items-center justify-between px-5 pb-3 pt-2">
            <span className="font-display text-xl font-semibold text-ink">More</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/6"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 stroke-ink" strokeWidth="2" strokeLinecap="round">
                <line x1="5" y1="5" x2="15" y2="15" />
                <line x1="15" y1="5" x2="5" y2="15" />
              </svg>
            </button>
          </div>

          {/* Admin toggle strip — only for admins */}
          {isAdmin ? (
            <div className="mx-4 mb-1 flex items-center justify-between rounded-[18px] bg-amber-50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">A</span>
                <span className="text-xs font-semibold text-amber-800">Admin access on</span>
              </div>
              <a
                href={router.pathname === '/admin' ? '/dashboard' : '/admin'}
                onClick={() => setOpen(false)}
                className="rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-amber-600"
              >
                {router.pathname === '/admin' ? '← Athlete view' : 'Admin panel →'}
              </a>
            </div>
          ) : null}

          {/* Sections */}
          <div className="max-h-[72vh] overflow-y-auto px-4 pb-8">
            {sheetSections.map((section, si) => (
              <div key={section.title} className={si > 0 ? 'mt-5' : ''}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  {section.icon}
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">
                    {section.title}
                  </span>
                </div>

                <div className="space-y-1 rounded-[22px] bg-ink/3 p-2">
                  {section.items
                    .filter((item) => !BOTTOM_NAV_HREFS.has(item.href))
                    .map((item) => {
                      const isActive = router.pathname === item.href;
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center justify-between rounded-[14px] px-4 py-3 transition ${
                            isActive ? 'bg-panel' : 'hover:bg-white'
                          }`}
                        >
                          <div>
                            <p className={`text-sm font-semibold ${isActive ? 'text-paper' : 'text-ink'}`}>
                              {item.label}
                            </p>
                            <p className={`mt-0.5 text-xs ${isActive ? 'text-paper/65' : 'text-ink/48'}`}>
                              {item.description}
                            </p>
                          </div>
                          {isActive ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-paper/60">
                              Here
                            </span>
                          ) : (
                            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 flex-shrink-0 stroke-ink/25" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 4l4 4-4 4" />
                            </svg>
                          )}
                        </a>
                      );
                    })}
                </div>
              </div>
            ))}

            {/* Quick CTA */}
            <a
              href="/log-intervention"
              onClick={() => setOpen(false)}
              className="mt-6 block rounded-full bg-ink py-3.5 text-center text-sm font-semibold text-paper"
            >
              + Log Intervention
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
