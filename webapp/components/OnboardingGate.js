import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { protectedRoutes } from '../lib/siteNavigation';

export default function OnboardingGate({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    async function checkGate() {
      const path = router.pathname;
      const isProtected = protectedRoutes.includes(path) || path.startsWith('/interventions/');

      if (!isProtected && path !== '/onboarding') {
        setStatus('ready');
        return;
      }

      try {
        const res = await fetch('/api/me');
        if (!res.ok) {
          if (!cancelled && isProtected) {
            router.replace(`/login?next=${encodeURIComponent(router.asPath || path)}`);
            return;
          }
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
          if (isProtected) {
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
