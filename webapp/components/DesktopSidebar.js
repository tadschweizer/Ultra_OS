import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { buildSidebarSections, getSidebarActiveHref } from '../lib/siteNavigation';

function itemClassName(isActive) {
  if (isActive) {
    return 'bg-panel text-paper';
  }

  return 'bg-transparent text-ink hover:bg-surface-light';
}

export default function DesktopSidebar() {
  const router = useRouter();
  const activeHref = getSidebarActiveHref(router.pathname);
  const [coachProfile, setCoachProfile] = useState(null);
  const [primaryCoach, setPrimaryCoach] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSidebarContext() {
      try {
        const response = await fetch('/api/me');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setCoachProfile(data.coachProfile || null);
          setPrimaryCoach(data.primaryCoach || null);
          setUnreadMessageCount(Number(data?.unreadMessageCount || 0));
          setHasUnreadNotifications(Number(data?.unreadNotificationCount || 0) > 0);
        }
      } catch {
        if (!cancelled) {
          setCoachProfile(null);
          setPrimaryCoach(null);
          setUnreadMessageCount(0);
          setHasUnreadNotifications(false);
        }
      }
    }

    loadSidebarContext();
    return () => {
      cancelled = true;
    };
  }, [router.pathname]);

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

  const sidebarSections = buildSidebarSections({
    hasCoachProfile: Boolean(coachProfile) || router.pathname.startsWith('/coach'),
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[210px] flex-col border-r border-border-subtle bg-paper lg:flex">
      <div className="flex h-full flex-col overflow-y-auto px-4 py-5">
        <a href="/dashboard" className="rounded-[22px] px-3 py-3 text-2xl font-semibold text-ink">
          <span className="font-display">Threshold</span>
        </a>
        {primaryCoach ? (
          <div className="mt-2 rounded-card border border-border-subtle bg-white px-3 py-3">
            <p className="ui-eyebrow">Coached By</p>
            <p className="mt-1 text-sm font-medium text-ink">{primaryCoach.display_name}</p>
          </div>
        ) : null}

        <div className="mt-4 flex-1 space-y-6">
          {sidebarSections.map((section, index) => (
            <section key={section.title}>
              <p
                className={`ui-eyebrow px-3 ${index === 0 ? '' : 'mt-2'}`}
              >
                {section.title}
              </p>
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const isActive = item.href === activeHref;
                  const isMessagesItem = item.href === '/messages';
                  const isNotificationsItem = item.href === '/notifications';
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-card px-3 py-2.5 text-sm font-medium transition ${itemClassName(isActive)}`}
                    >
                      <span>{item.label}</span>
                      {isMessagesItem && unreadMessageCount > 0 ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? 'bg-paper text-ink' : 'bg-amber-500 text-white'}`}>
                          {unreadMessageCount}
                        </span>
                      ) : isNotificationsItem && hasUnreadNotifications ? (
                        <span
                          aria-label="Unread notifications"
                          className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-paper' : 'bg-amber-500'}`}
                        />
                      ) : null}
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6 pt-2">
          <a
            href="/log-intervention"
            className="ui-button-primary block w-full text-center"
          >
            Log Intervention
          </a>
        </div>
      </div>
    </aside>
  );
}
