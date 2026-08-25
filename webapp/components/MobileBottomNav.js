import { useRouter } from 'next/router';
import { getMobileTabs } from '../lib/siteNavigation';
import { useMe } from '../lib/meClient';

function TabIcon({ tab, active }) {
  const className = `h-5 w-5 ${active ? 'text-ink' : 'text-ink/65'}`;
  if (tab.label === 'Roster') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 10 0v2M16 4h5M18.5 1.5v5"/></svg>;
  }
  if (tab.label === 'Calendar') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
  }
  if (tab.label === 'Messages') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>;
  }
  if (tab.label === 'Profile') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  }
  if (tab.label === 'Research') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
  }
  if (tab.label === 'History') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}

export default function MobileBottomNav() {
  const router = useRouter();
  const me = useMe();
  if (!me?.account) return null;
  const tabs = getMobileTabs(me.account);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-white/95 backdrop-blur lg:hidden" aria-label="Primary navigation">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const isActive = router.pathname === tab.href
            || (tab.href !== '/dashboard' && router.pathname.startsWith(tab.href));
          return (
            <a key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center justify-center py-2">
              {tab.primary ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink shadow-[0_4px_14px_rgba(19,24,22,0.22)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 text-paper"><path d="M12 5v14M5 12h14"/></svg>
                </span>
              ) : <TabIcon tab={tab} active={isActive} />}
              <span className={`mt-1 text-[10px] font-semibold tracking-wide ${isActive ? 'text-ink' : 'text-ink/65'}`}>
                {tab.label}
              </span>
            </a>
          );
        })}
      </div>
      <div className="bg-white/95" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </nav>
  );
}
