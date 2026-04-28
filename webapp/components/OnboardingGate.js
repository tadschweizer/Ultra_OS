import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isProtectedRoutePath } from '../lib/siteNavigation';

export default function OnboardingGate({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    let cancelled = false;

    async function checkGate() {
      const path = router.pathname;
      const isProtected = isProtectedRoutePath(path);
      const needsGate = isProtected || path === '/onboarding';
      const isPreviewOnboarding = path === '/onboarding' && typeof router.query.preview === 'string';

      if (!needsGate) {
        setStatus('ready');
        return;
      }

      if (isPreviewOnboarding) {
        setStatus('ready');
        return;
      }

      try {
        const res = await fetch('/api/me');
        if (!res.ok && res.status === 401) {
          if (!cancelled) {
            router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
          }
          return;
        }

        if (!res.ok) {
          setStatus('ready');
          return;
        }

        const data = await res.json();
        const completed = Boolean(data.athlete?.onboarding_complete);

        if (!cancelled) {
          if (!completed && path !== '/onboarding') {
            router.replace('/onboarding');
            return;
          }

          if (completed && path === '/onboarding') {
            router.replace('/dashboard');
            return;
          }

          setStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setStatus('ready');
        }
      }
    }

    checkGate();
    return () => {
      cancelled = true;
    };
  }, [router.asPath, router.isReady, router.pathname]);

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
