import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { protectedRoutes } from '../lib/siteNavigation';
import { fetchMe, getCachedMe } from '../lib/meClient';

export default function OnboardingGate({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    async function checkGate() {
      const path = router.pathname;
      const isProtected = protectedRoutes.includes(path) || path.startsWith('/interventions/') || path.startsWith('/coach/');

      if (!isProtected && path !== '/onboarding') {
        setStatus('ready');
        return;
      }

      // Fast path: a cached session from earlier in this browser session lets
      // us render immediately. The fetch below still revalidates in the
      // background and redirects if the session has actually expired.
      const cached = getCachedMe();
      if (cached?.athlete?.onboarding_complete && path !== '/onboarding') {
        setStatus('ready');
      }

      try {
        const data = await fetchMe();
        if (cancelled) return;

        if (!data) {
          if (isProtected) {
            router.replace(`/login?next=${encodeURIComponent(router.asPath || path)}`);
            return;
          }
          setStatus('ready');
          return;
        }

        const completed = Boolean(data.athlete?.onboarding_complete);

        if (!completed && path !== '/onboarding') {
          router.replace('/onboarding');
          return;
        }

        if (completed && path === '/onboarding') {
          router.replace('/dashboard');
          return;
        }

        setStatus('ready');
      } catch {
        if (!cancelled) {
          if (isProtected && !cached) {
            router.replace(`/login?next=${encodeURIComponent(router.asPath || path)}`);
            return;
          }
          setStatus('ready');
        }
      }
    }

    checkGate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status !== 'ready') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
        <div className="rounded-[28px] border border-ink/10 bg-white px-6 py-4 text-sm text-ink/70">
          Loading...
        </div>
      </div>
    );
  }

  return children;
}
