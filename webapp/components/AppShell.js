import { useRouter } from 'next/router';
import DesktopSidebar from './DesktopSidebar';
import MobileBottomNav from './MobileBottomNav';
import RaceCountdownBanner from './RaceCountdownBanner';
import { appShellExcludedRoutes } from '../lib/siteNavigation';

export default function AppShell({ children }) {
  const router = useRouter();
  const useShell = !appShellExcludedRoutes.includes(router.pathname);

  if (!useShell) {
    return children;
  }

  return (
    <>
      <DesktopSidebar />
      <div className="pb-20 lg:pb-0 lg:pl-[210px]">
        <div className="pt-4">
          <RaceCountdownBanner />
        </div>
        {children}
      </div>
      <MobileBottomNav />
    </>
  );
}
