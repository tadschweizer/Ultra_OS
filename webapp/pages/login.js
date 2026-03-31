import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import NavMenu from '../components/NavMenu';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);

  // Redirect already-authenticated users
  useEffect(() => {
    const match = document.cookie.match(/athlete_id=([^;]+)/);
    if (match) {
      window.location.href = '/dashboard';
    } else {
      setChecking(false);
    }
  }, []);

  async function handleEmailLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }
      window.location.href = data.onboardingComplete ? '/dashboard' : '/onboarding';
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    const supabase = getSupabaseClient();
    const siteUrl = window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (oauthError) {
      setError('Google sign-in failed. Please try again.');
      setLoading(false);
    }
    // If no error, the browser will redirect — no further action needed here
  }

  if (checking) return null;

  return (
    <main className="min-h-screen bg-paper text-ink">

      {/* Nav */}
      <div className="sticky top-0 z-50 px-4 pt-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between rounded-full border border-ink/10 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <a href="/" className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">UltraOS</a>
            <NavMenu
              label="Login navigation"
              links={[
                { href: '/guide', label: 'How It Works' },
                { href: '/content', label: 'Research' },
                { href: '/pricing', label: 'Pricing' },
              ]}
              primaryLink={{ href: '/signup', label: 'Sign Up' }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-16">

        <div className="rounded-[32px] border border-ink/10 bg-white px-8 py-10 shadow-[0_8px_32px_rgba(19,24,22,0.07)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Welcome Back</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Log in to UltraOS</h1>
          <p className="mt-2 text-sm text-ink/55">Don't have an account?{' '}
            <a href="/signup" className="font-semibold text-accent hover:underline">Sign up free</a>
          </p>

          {error && (
            <div className="mt-6 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Email/password form */}
          <form onSubmit={handleEmailLogin} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-[14px] border border-ink/12 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
                  Password
                </label>
                {/* TODO: Add forgot password flow */}
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-[14px] border border-ink/12 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper shadow-[0_4px_16px_rgba(19,24,22,0.2)] transition hover:opacity-85 disabled:opacity-50"
            >
              {loading ? 'Logging in…' : 'Log In →'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/8" />
            <span className="text-xs text-ink/35">or continue with</span>
            <div className="h-px flex-1 bg-ink/8" />
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/12 bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-white disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <a
              href="/api/strava/login"
              className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/12 bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#FC4C02" aria-hidden="true">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
              </svg>
              Continue with Strava
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-ink/35">
          By logging in you agree to our terms of service and privacy policy.
        </p>
      </div>
    </main>
  );
}
