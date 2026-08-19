import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

function InviteShell({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
      <div className="w-full max-w-md rounded-[30px] border border-ink/10 bg-white p-7 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)] sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">Coach invitation</p>
        {children}
      </div>
    </main>
  );
}

function CoachInvitationJoin({ token }) {
  const [status, setStatus] = useState('checking');
  const [preview, setPreview] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [message, setMessage] = useState('');
  const acceptingRef = useRef(false);
  const returnPath = `/join?coach_invite=${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;
  const signupHref = `/signup?role=athlete-with-coach&next=${encodeURIComponent(returnPath)}`;

  useEffect(() => {
    let cancelled = false;
    async function loadInvitation() {
      try {
        const [inviteResponse, meResponse] = await Promise.all([
          fetch(`/api/coach/accept-invitation?token=${encodeURIComponent(token)}`, { cache: 'no-store' }),
          fetch('/api/me', { cache: 'no-store', credentials: 'include' }),
        ]);
        const invite = await inviteResponse.json().catch(() => ({}));
        if (cancelled) return;
        setPreview(invite);
        setAuthenticated(meResponse.ok);
        setMessage(invite.error || '');
        setStatus(inviteResponse.ok ? 'ready' : (invite.code || 'error'));
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Could not check this invitation. Please refresh and try again.');
        }
      }
    }
    loadInvitation();
    return () => { cancelled = true; };
  }, [token]);

  async function acceptInvitation() {
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    setStatus('accepting');
    setMessage('');
    try {
      const response = await fetch('/api/coach/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      setPreview((current) => ({ ...current, ...data }));
      setMessage(data.error || '');
      setStatus(response.ok ? (data.already_accepted ? 'already_accepted' : 'accepted') : (data.code || 'error'));
    } catch {
      setStatus('error');
      setMessage('Network error. Your invitation was not accepted. Please try again.');
    } finally {
      acceptingRef.current = false;
    }
  }

  if (status === 'checking') {
    return <InviteShell><div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" /><p className="mt-4 text-sm text-ink/55">Checking invitation…</p></InviteShell>;
  }

  const coachName = preview?.coach?.display_name || 'your coach';
  if (status === 'ready') {
    return (
      <InviteShell>
        <h1 className="mt-4 font-display text-3xl font-semibold">Join {coachName} on Threshold</h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">
          Accepting connects your athlete account with {coachName}, so they can coach you using the training and check-in information you share.
        </p>
        {preview?.expires_at ? <p className="mt-3 text-xs text-ink/45">Invitation expires {new Date(preview.expires_at).toLocaleString()}.</p> : null}
        {authenticated ? (
          <button type="button" onClick={acceptInvitation} className="mt-7 w-full rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper">
            Accept invitation
          </button>
        ) : (
          <div className="mt-7 grid gap-3">
            <a href={signupHref} className="rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper">Create athlete account</a>
            <a href={loginHref} className="rounded-full border border-ink/15 px-6 py-3.5 text-sm font-semibold text-ink">Log in to accept</a>
            <p className="text-xs leading-5 text-ink/45">You will return to this invitation after signup or login.</p>
          </div>
        )}
      </InviteShell>
    );
  }

  if (status === 'accepting') {
    return <InviteShell><div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" /><p className="mt-4 text-sm text-ink/55">Connecting your accounts…</p></InviteShell>;
  }

  if (status === 'accepted' || status === 'already_accepted') {
    return (
      <InviteShell>
        <h1 className="mt-4 font-display text-3xl font-semibold">{status === 'accepted' ? 'Invitation accepted' : 'Already connected'}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">You are connected to {coachName}. The relationship now appears in your account and your coach&apos;s roster.</p>
        <a href="/dashboard" className="mt-7 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper">Continue to Threshold</a>
      </InviteShell>
    );
  }

  const titles = {
    invalid: 'Invalid invitation',
    expired: 'Invitation expired',
    used: 'Invitation already used',
    wrong_account: 'Use the invited account',
    error: 'Could not accept invitation',
  };
  return (
    <InviteShell>
      <h1 className="mt-4 font-display text-3xl font-semibold">{titles[status] || 'Invitation unavailable'}</h1>
      <p className="mt-3 text-sm leading-6 text-ink/60">{message || 'Ask your coach to send a new invitation.'}</p>
      {status === 'wrong_account' ? <a href={loginHref} className="mt-7 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper">Log in with another account</a> : null}
      {status === 'error' ? <button type="button" onClick={() => window.location.reload()} className="mt-7 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper">Try again</button> : null}
    </InviteShell>
  );
}

export default function JoinPage() {
  const router = useRouter();
  if (!router.isReady) return <InviteShell><p className="mt-4 text-sm text-ink/55">Checking invitation…</p></InviteShell>;
  const coachToken = typeof router.query.coach_invite === 'string' ? router.query.coach_invite : '';
  if (coachToken) return <CoachInvitationJoin token={coachToken} />;
  return <LegacyInviteJoin router={router} token={router.query.token} />;
}

/**
 * /join?token=XXX
 *
 * Step 1: Validate the invite token
 * Step 2: User clicks "Connect Strava" → we set the invite cookie → redirect to Strava OAuth
 *
 * After Strava OAuth completes, the callback handler marks the invite used
 * and redirects to onboarding (new user) or dashboard (returning user).
 */
function LegacyInviteJoin({ router, token }) {

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
          <p className="text-[11px] uppercase tracking-[0.25em] text-ink/35">Invite</p>
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
          <p className="text-[11px] uppercase tracking-[0.25em] text-ink/35">Invite</p>
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
          <p className="text-[11px] uppercase tracking-[0.25em] text-ink/35">Invite</p>
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
          <p className="font-display text-2xl font-semibold tracking-tight text-ink">Threshold</p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-ink/40">Performance Intelligence</p>
        </div>

        <div className="rounded-[36px] border border-ink/10 bg-white p-8 shadow-[0_24px_60px_rgba(19,24,22,0.10)]">
          <h1 className="text-center font-display text-3xl font-semibold leading-tight text-ink">
            You&apos;re invited to Threshold
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-ink/60">
            Connect your Strava account to create your athlete profile. Threshold will track your training interventions and surface what actually works for you — as an individual.
          </p>

          <div className="mt-8 space-y-3">
            <div className="rounded-[18px] border border-ink/10 bg-paper px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">N=1 correlations</p>
                <p className="mt-0.5 text-xs leading-5 text-ink/55">See what interventions actually move the needle for your body</p>
              </div>
            </div>
            <div className="rounded-[18px] border border-ink/10 bg-paper px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">72+ research studies</p>
                <p className="mt-0.5 text-xs leading-5 text-ink/55">Curated endurance research with plain-English takeaways</p>
              </div>
            </div>
            <div className="rounded-[18px] border border-ink/10 bg-paper px-4 py-3">
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
            By connecting, you agree to Threshold accessing your Strava activity data. No password required — you sign in through Strava.
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
