import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { isPublicRoutePath } from '../lib/siteNavigation';

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
      { href: '/messages', label: 'Messages', description: 'Coach-athlete conversations' },
      { href: '/coach-command-center', label: 'Coach Command Center', description: 'Roster, notes, invites, and protocols' },
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

export default function NavMenu({ links = [], primaryLink = null }) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const isPublicMenu = isPublicRoutePath(router.pathname);
  const publicLinks = links.filter(Boolean);

  // Portal target — wait for client mount so document.body exists
  useEffect(() => { setMounted(true); }, []);

  // Fetch admin status once on mount
  useEffect(() => {
    if (isPublicMenu) {
      setIsAdmin(false);
      setUnreadMessageCount(0);
      setHasUnreadNotifications(false);
      return;
    }

    fetch('/api/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setIsAdmin(Boolean(data?.athlete?.is_admin));
        setUnreadMessageCount(Number(data?.unreadMessageCount || 0));
        setHasUnreadNotifications(Number(data?.unreadNotificationCount || 0) > 0);
      })
      .catch(() => {});
  }, [isPublicMenu, router.pathname]);

  useEffect(() => {
    function handleNotificationCountUpdate(event) {
      setHasUnreadNotifications(Number(event.detail?.unreadCount || 0) > 0);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('threshold:notifications-unread-count', handleNotificationCountUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('threshold:notifications-unread-count', handleNotificationCountUpdate);
      }
    };
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

  if (isPublicMenu) {
    return (
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-5 lg:flex">
            {publicLinks.map((link) => {
              const isActive = router.pathname === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-semibold transition ${
                    isActive ? 'text-ink' : 'text-ink/65 hover:text-ink'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          {primaryLink ? (
            <a
              href={primaryLink.href}
              className={primaryLink.variant === 'secondary' ? 'ui-button-secondary py-2' : 'ui-button-primary py-2'}
            >
              {primaryLink.label}
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-pill border border-ink/10 bg-white/70 text-ink backdrop-blur transition lg:hidden"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
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

        {mounted && open ? createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] lg:hidden"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            <div
              aria-hidden={false}
              className="fixed inset-x-0 bottom-0 z-50 translate-y-0 transition-transform duration-300 ease-out lg:hidden"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="rounded-t-[32px] bg-white shadow-[0_-8px_40px_rgba(19,24,22,0.18)]">
                <div className="flex justify-center pb-1 pt-3">
                  <div className="h-1 w-10 rounded-full bg-ink/15" />
                </div>
                <div className="flex items-center justify-between px-5 pb-3 pt-2">
                  <span className="font-display text-xl font-semibold text-ink">Menu</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(false);
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/8 transition active:bg-ink/15"
                    aria-label="Close menu"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 stroke-ink" strokeWidth="2" strokeLinecap="round">
                      <line x1="5" y1="5" x2="15" y2="15" />
                      <line x1="15" y1="5" x2="5" y2="15" />
                    </svg>
                  </button>
                </div>

                <div className="max-h-[72vh] overflow-y-auto px-4 pb-8">
                  <div className="space-y-1 rounded-[22px] bg-ink/3 p-2">
                    {publicLinks.map((link) => {
                      const isActive = router.pathname === link.href;
                      return (
                        <a
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center justify-between rounded-[14px] px-4 py-4 transition ${
                            isActive ? 'bg-panel text-paper' : 'text-ink hover:bg-white'
                          }`}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <span className="text-sm font-semibold">{link.label}</span>
                          {isActive ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-paper/70">
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

                  {primaryLink ? (
                    <a
                      href={primaryLink.href}
                      onClick={() => setOpen(false)}
                      className="mt-6 block rounded-full bg-ink py-3.5 text-center text-sm font-semibold text-paper"
                    >
                      {primaryLink.label}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </>,
          document.body
        ) : null}
      </div>
    );
  }

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

      {/* Backdrop + sheet — portalled to document.body so backdrop-filter
          ancestors on page nav bars don't hijack the fixed containing block */}
        {mounted && open ? createPortal(
        <>
          {/* Backdrop — tap to dismiss */}
          <div
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-up bottom sheet */}
          <div
            aria-hidden={false}
            className="fixed inset-x-0 bottom-0 z-50 translate-y-0 transition-transform duration-300 ease-out lg:hidden"
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
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/8 transition active:bg-ink/15"
              aria-label="Close menu"
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
                      const isNotificationsItem = item.href === '/notifications';
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
                          {item.href === '/messages' && unreadMessageCount > 0 ? (
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isActive ? 'bg-paper text-ink' : 'bg-amber-500 text-white'}`}>
                              {unreadMessageCount}
                            </span>
                          ) : isNotificationsItem && hasUnreadNotifications ? (
                            <span
                              aria-label="Unread notifications"
                              className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-paper' : 'bg-amber-500'}`}
                            />
                          ) : isActive ? (
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
        </>,
        document.body
      ) : null}
    </div>
  );
}
