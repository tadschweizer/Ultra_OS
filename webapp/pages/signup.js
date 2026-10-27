import { athleteAccessMessage, athleteOpenAccess } from '../lib/athleteAccessPolicy';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import PublicHeader from '../components/PublicHeader';
import PasswordField from '../components/PasswordField';
import { validatePassword } from '../lib/auth/contracts.js';
import { buildOnboardingPath, isCoachInvitationPath, safePostAuthPath } from '../lib/auth/redirects.js';
import { getPublicCheckoutPath } from '../lib/billingPlans.js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const ROLE_OPTIONS = [
  {
    id: 'coach',
    label: "I'm a coach",
    description: 'Plan training, review completed sessions, and give your athletes feedback.',
  },
  {
    id: 'athlete-with-coach',
    label: "I'm an athlete joining a coach",
    description: 'Accept your coach’s invitation or enter their code to share training and feedback.',
  },
  {
    id: 'individual',
    label: "I'm an individual athlete",
    description: 'Plan your own training, record workouts, and review your progress.',
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState('individual');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [nextPath, setNextPath] = useState('/dashboard');

  useEffect(() => {
    const queryRole = typeof router.query.role === 'string' ? router.query.role : '';
    if (ROLE_OPTIONS.some((option) => option.id === queryRole)) {
      selectRole(queryRole);
    }
  }, [router.query.role]);

  function selectRole(nextRole) {
    setRole(nextRole);
  }

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      const params = new URLSearchParams(window.location.search);
      const checkoutPath = getPublicCheckoutPath(params.get('plan'));
      const destination = checkoutPath || safePostAuthPath(params.get('next'));
      if (!cancelled) setNextPath(destination);
      try {
        const res = await fetch('/api/me', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const defaultPath = data.account?.default_path || '/dashboard';
          const hasExplicitDestination = Boolean(params.get('next') || checkoutPath);
          window.location.href = data.athlete?.onboarding_complete || isCoachInvitationPath(destination)
            ? (hasExplicitDestination ? destination : defaultPath)
            : buildOnboardingPath(destination);
          return;
        }
      } catch {
        // Show the signup form if the session check cannot complete.
      }

      if (cancelled) return;

      // The session cookie is httpOnly now; ask the server to clear it.
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      setChecking(false);
    }

    checkExistingSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isCoachInvitationPath(nextPath)) setRole('athlete-with-coach');
  }, [nextPath]);

  async function handleEmailSignup(event) {
    event.preventDefault();
    setError('');
    // Same rule the API enforces, imported from lib/auth/contracts.js so the
    // two can never disagree about what counts as an acceptable password.
    const passwordProblem = validatePassword(password, { email });
    if (passwordProblem) {
      setError(passwordProblem);
      return;
    }
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, next: nextPath }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Signup failed. Please try again.');
        setLoading(false);
        return;
      }
      window.location.href = data.onboardingComplete || isCoachInvitationPath(nextPath)
        ? nextPath
        : buildOnboardingPath(nextPath);
    } catch {
      setError('Could not connect to Threshold. Check your connection and try again. Your entries are still here.');
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError('');
    setLoading(true);
    try {
      const intentResponse = await fetch('/api/auth/role-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, next: nextPath }),
      });
      if (!intentResponse.ok) {
        const intentData = await intentResponse.json().catch(() => ({}));
        setError(intentData.error || 'Could not save your signup choice. Please try again.');
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (oauthError) {
        setError('Google sign-up failed. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Google sign-up could not start. Check your connection and try again.');
      setLoading(false);
    }
  }

  if (checking) return <main className="public-site min-h-screen bg-paper text-ink"><PublicHeader /><p role="status" className="mx-auto max-w-md px-4 py-10">Checking your session…</p></main>;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <PublicHeader primaryLink={{ href: `/login?next=${encodeURIComponent(nextPath)}`, label: 'Log in' }} />

      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-ink/10 bg-white px-5 py-7 sm:px-8">
          <h1 className="mt-3 text-3xl font-semibold text-ink">Create your account</h1>
          <p className="mt-2 text-sm text-ink/75">
            Already have an account? <a href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-ink hover:underline">Log in</a>
          </p>

          {isCoachInvitationPath(nextPath) ? <p className="mt-6 rounded-xl bg-paper p-4 text-sm leading-6">You’re creating an athlete account for your coach’s invitation. After signup, accept the invitation to connect.</p> : <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-semibold text-ink">How will you use Threshold?</legend>
            <div className="space-y-2">
              {ROLE_OPTIONS
                .filter((option) => !isCoachInvitationPath(nextPath) || option.id !== 'coach')
                .map((option) => {
                const active = role === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-[14px] border px-4 py-3 text-left transition focus-within:ring-2 focus-within:ring-ink ${
                      active
                        ? 'border-accent bg-accent/8 ring-2 ring-accent/20'
                        : 'border-ink/12 bg-paper hover:border-ink/25'
                    }`}
                  >
                    <input type="radio" name="signup-role" value={option.id} checked={active}
                      onChange={() => selectRole(option.id)} aria-labelledby={`role-${option.id}-label`} aria-describedby={`role-${option.id}-description`} className="mt-1 h-4 w-4 shrink-0 accent-ink" />
                    <span>
                    <span id={`role-${option.id}-label`} className={`block text-sm font-semibold ${active ? 'text-ink' : 'text-ink'}`}>{option.label}</span>
                    <span id={`role-${option.id}-description`} className="mt-1 block text-sm leading-5 text-ink/75">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>}

          <div className="mt-5 rounded-[14px] border border-accent/20 bg-accent/8 px-4 py-3">
            <p className="text-xs font-semibold text-ink">{role === 'coach' ? 'Coach pilot access' : athleteOpenAccess() ? 'Free athlete access' : 'Athlete access'}</p>
            <p className="mt-1 text-sm leading-6 text-ink/80" aria-live="polite">
              {role === 'coach'
                ? 'Create your coach account for the closed pilot. An administrator must approve pilot access separately. Choosing Coach does not activate a pilot or paid plan. No card is required for the pilot.'
                : athleteAccessMessage()}
            </p>
          </div>

          {error ? (
            <div role="alert" className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleEmailSignup} className="mt-7 space-y-4">
            <div>
              <label htmlFor="signup-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-ink/75">Name</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-[14px] border border-ink/12 bg-paper px-4 py-3 text-base text-ink placeholder-ink/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-ink/75">Email</label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-[14px] border border-ink/12 bg-paper px-4 py-3 text-base text-ink placeholder-ink/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <PasswordField
              id="signup-password"
              value={password}
              onChange={setPassword}
              email={email}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper shadow-[0_4px_16px_rgba(19,24,22,0.2)] transition hover:opacity-85 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/8" />
            <span className="text-xs text-ink/75">or sign up with</span>
            <div className="h-px flex-1 bg-ink/8" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/12 bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-white disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <a
              href={`/api/strava/login?next=${encodeURIComponent(nextPath)}&role=${encodeURIComponent(role)}`}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/12 bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-white"
            >
              Continue with Strava
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
