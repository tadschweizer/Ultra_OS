import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AuthShell, { authSubmitClass } from '../components/AuthShell';
import PasswordField from '../components/PasswordField';
import { getAccessTokenFromCallbackUrl } from '../lib/auth/oauth.js';
import { validatePassword } from '../lib/auth/contracts.js';
import { clearMe } from '../lib/meClient';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Landing page for the recovery link in the reset email.
 *
 * Supabase delivers the recovery session either as a PKCE `code` query param
 * or as tokens in the URL hash, depending on project configuration — the same
 * two shapes /auth/callback already handles, so the same recovery order is
 * used here.
 */
export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function recoverSession() {
      const supabase = getSupabaseClient();
      let token = null;

      const code = new URL(window.location.href).searchParams.get('code');
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (!exchangeError) token = data?.session?.access_token || null;
      }

      if (!token) {
        const hashTokens = getAccessTokenFromCallbackUrl(window.location.href);
        if (hashTokens?.accessToken && hashTokens?.refreshToken) {
          const { data, error: setError2 } = await supabase.auth.setSession({
            access_token: hashTokens.accessToken,
            refresh_token: hashTokens.refreshToken,
          });
          if (!setError2) token = data?.session?.access_token || null;
        }
      }

      if (!token) {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || null;
      }

      setAccessToken(token);
      setChecking(false);
    }

    recoverSession();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const problem = validatePassword(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirmation) {
      setError('Those two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Could not set your new password. Please try again.');
        setLoading(false);
        return;
      }

      clearMe();
      setDone(true);
      // The server already signed this browser back in with a fresh cookie.
      setTimeout(() => {
        window.location.href = data.onboardingComplete ? '/dashboard' : '/onboarding';
      }, 1200);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (checking) return null;

  if (!accessToken) {
    return (
      <AuthShell
        eyebrow="Password Reset"
        title="This link has expired"
        error="Reset links last one hour and can only be used once."
        navLabel="Reset password navigation"
      >
        <a href="/forgot-password" className={`${authSubmitClass} mt-8 inline-block text-center`}>
          Send me a new link →
        </a>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="All Set"
        title="Password updated"
        notice="You're signed in on this device. Every other device has been signed out."
        navLabel="Reset password navigation"
      >
        <p className="mt-6 text-sm text-ink/55">Taking you to your dashboard...</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password Reset"
      title="Choose a new password"
      subtitle="Setting a new password signs you out on every other device."
      error={error}
      navLabel="Reset password navigation"
    >
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={confirmation}
          onChange={setConfirmation}
          showMeter={false}
        />
        <button type="submit" disabled={loading} className={authSubmitClass}>
          {loading ? 'Saving...' : 'Set new password →'}
        </button>
      </form>
    </AuthShell>
  );
}
