import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

/**
 * /join?token=XXX
 *
 * Step 1: Validate the invite token
 * Step 2: User clicks "Connect Strava" → we set the invite cookie → redirect to Strava OAuth
 *
 * After Strava OAuth completes, the callback handler marks the invite used
 * and redirects to onboarding (new user) or dashboard (returning user).
 */
export default function JoinPage() {
  const router = useRouter();
  const { token } = router.query;

  const [status, setStatus] = useState('checking'); // checking | valid | invalid | used | error
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    if (!token) {
      setStatus('invalid');
      return;
    }

    async function validateToken() {
      try {
        const res = await fetch('/api/invites', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (res.status === 404) { setStatus('invalid'); return; }
        if (res.status === 409) { setStatus('used'); return; }
        if (!res.ok) { setStatus('error'); return; }
        setStatus('valid');
      } catch (_) {
        setStatus('error');
      }
    }

    validateToken();
  }, [router.isReady, token]);

  async function handleConnect() {
    setConnecting(true);
    setErrorMsg('');

    try {
      // Set the invite cookie so the Strava callback can mark it used
      const res = await fetch('/api/set-invite-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Could not start sign-up. Try the invite link again.');
        setConnecting(false);
        return;
      }

      // Redirect to Strava OAuth
      window.location.href = '/api/strava/login';
    } catch (_) {
      setErrorMsg('Network error. Please try again.');
      setConnecting(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────
  if (status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          <p className="mt-4 text-sm text-ink/55">Checking invite…</p>
        </div>
      </main>
    );
  }

  // ── Invalid token ─────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="max-w-sm rounded-[30px] border border-ink/10 bg-white p-8 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-3xl">🔗</p>
          <p className="mt-4 font-semibold text-ink">Invalid invite link</p>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            This invite link doesn&apos;t look right. Check the URL or ask for a new invite.
          </p>
          <a href="/" className="mt-6 inline-flex rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold text-ink">
            Go to homepage
          </a>
        </div>
      </main>
    );
  }

  // ── Already used ──────────────────────────────────────────────
  if (status === 'used') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="max-w-sm rounded-[30px] border border-ink/10 bg-white p-8 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-3xl">✓</p>
          <p className="mt-4 font-semibold text-ink">This invite has already been used</p>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            Each invite link can only be used once. If you already created an account, go to the dashboard. Otherwise, request a new invite.
          </p>
          <a href="/dashboard" className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
            Go to dashboard
          </a>
        </div>
      </main>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="max-w-sm rounded-[30px] border border-ink/10 bg-white p-8 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-3xl">⚠️</p>
          <p className="mt-4 font-semibold text-ink">Something went wrong</p>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            Could not validate the invite. Try refreshing, or contact the person who sent you the link.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  // ── Valid — show join screen ───────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight text-ink">UltraOS</p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-ink/40">Performance Intelligence</p>
        </div>

        <div className="rounded-[36px] border border-ink/10 bg-white p-8 shadow-[0_24px_60px_rgba(19,24,22,0.10)]">
          <div className="mb-6 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-2xl">
              🏔️
            </span>
          </div>

          <h1 className="text-center font-display text-3xl font-semibold leading-tight text-ink">
            You&apos;re invited to UltraOS
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-ink/60">
            Connect your Strava account to create your athlete profile. UltraOS will track your training interventions and surface what actually works for you — as an individual.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-start gap-3 rounded-[18px] bg-paper px-4 py-3">
              <span className="mt-0.5 text-base">📊</span>
              <div>
                <p className="text-sm font-semibold text-ink">N=1 correlations</p>
                <p className="mt-0.5 text-xs leading-5 text-ink/55">See what interventions actually move the needle for your body</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[18px] bg-paper px-4 py-3">
              <span className="mt-0.5 text-base">🔬</span>
              <div>
                <p className="text-sm font-semibold text-ink">72+ research studies</p>
                <p className="mt-0.5 text-xs leading-5 text-ink/55">Curated endurance research with plain-English takeaways</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[18px] bg-paper px-4 py-3">
              <span className="mt-0.5 text-base">🏁</span>
              <div>
                <p className="text-sm font-semibold text-ink">Race blueprints</p>
                <p className="mt-0.5 text-xs leading-5 text-ink/55">Build and log race plans, then debrief what worked</p>
              </div>
            </div>
          </div>

          {errorMsg ? (
            <p className="mt-4 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</p>
          ) : null}

          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-[#FC4C02] px-6 py-4 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(252,76,2,0.30)] transition hover:opacity-90 disabled:opacity-50"
          >
            {connecting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Connecting…
              </>
            ) : (
              <>
                {/* Strava logo mark */}
                <svg viewBox="0 0 40 40" className="h-5 w-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 4L8 20h5.5L16 14.5 18.5 20H24L16 4zm8 16l-2.5 5 2.5 5 2.5-5L24 20z" />
                </svg>
                Connect with Strava
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-ink/35">
            By connecting, you agree to UltraOS accessing your Strava activity data. No password required — you sign in through Strava.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-ink/30">
          Already have an account?{' '}
          <a href="/api/strava/login" className="underline underline-offset-4">
            Sign in with Strava
          </a>
        </p>
      </div>
    </main>
  );
}
