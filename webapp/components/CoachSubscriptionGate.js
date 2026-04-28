import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function CoachStatusBanner({ profile }) {
  if (!profile) return null;

  if (profile.subscription_status === 'past_due') {
    return (
      <div className="mx-auto mt-4 max-w-[1280px] px-4 md:px-6 lg:px-8">
        <div className="rounded-[20px] border border-amber-300 bg-amber-100 px-5 py-4 text-sm text-amber-950">
          Payment is past due. Coach access is still on, but your billing needs attention.
          {' '}
          <a href="/api/coach/billing/portal" className="font-semibold underline underline-offset-4">
            Update payment method
          </a>
        </div>
      </div>
    );
  }

  if (profile.subscription_status === 'cancelled' && profile.subscription_current_period_end) {
    return (
      <div className="mx-auto mt-4 max-w-[1280px] px-4 md:px-6 lg:px-8">
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          Your coach plan is set to end on {formatDate(profile.subscription_current_period_end)}.
          {' '}
          <a href="/api/coach/billing/portal" className="font-semibold underline underline-offset-4">
            Manage subscription
          </a>
        </div>
      </div>
    );
  }

  return null;
}

function LoadingScreen() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-6 lg:px-8">
      <div className="rounded-[28px] border border-border-subtle bg-white p-6 shadow-warm">
        <p className="text-sm text-ink/60">Checking coach billing access...</p>
      </div>
    </div>
  );
}

export default function CoachSubscriptionGate({ children }) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, profile: null });

  const shouldGuard = useMemo(() => {
    return router.pathname.startsWith('/coach/') && router.pathname !== '/coach/setup';
  }, [router.pathname]);

  useEffect(() => {
    if (!shouldGuard) {
      setState({ loading: false, profile: null });
      return;
    }

    let cancelled = false;

    async function loadCoachSubscription() {
      setState((current) => ({ ...current, loading: true }));

      try {
        const response = await fetch('/api/coach/subscription');
        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
          return;
        }

        if (!response.ok) {
          setState({ loading: false, profile: null });
          return;
        }

        if (!data.hasAccess) {
          router.replace('/coach/setup');
          return;
        }

        setState({ loading: false, profile: data.profile || null });
      } catch (error) {
        if (!cancelled) {
          console.error('[CoachSubscriptionGate] failed:', error);
          setState({ loading: false, profile: null });
        }
      }
    }

    loadCoachSubscription();
    return () => {
      cancelled = true;
    };
  }, [router, shouldGuard]);

  if (!shouldGuard) {
    return children;
  }

  if (state.loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <CoachStatusBanner profile={state.profile} />
      {children}
    </>
  );
}
