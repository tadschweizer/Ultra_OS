import { useRouter } from 'next/router';
import { getSidebarActiveHref, sidebarSections } from '../lib/siteNavigation';

function itemClassName(isActive) {
  if (isActive) {
    return 'bg-panel text-paper';
  }

  return 'bg-transparent text-ink hover:bg-surface-light';
}

export default function DesktopSidebar() {
  const router = useRouter();
  const activeHref = getSidebarActiveHref(router.pathname);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[210px] flex-col border-r border-border-subtle bg-paper lg:flex">
      <div className="flex h-full flex-col overflow-y-auto px-4 py-5">
        <a href="/dashboard" className="rounded-[22px] px-3 py-3 text-2xl font-semibold text-ink">
          <span className="font-display">UltraOS</span>
        </a>

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
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`block rounded-card px-3 py-2.5 text-sm font-medium transition ${itemClassName(isActive)}`}
                    >
                      {item.label}
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
