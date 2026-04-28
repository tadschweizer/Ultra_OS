import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function getHashParams() {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Processing your sign-in...');

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const isLinkMode = params.get('link') === '1';
      const nextUrl = params.get('next') || '';
      const supabase = getSupabaseClient();
      const hashParams = getHashParams();
      let sessionData = null;
      let sessionError = null;

      const oauthErrorDescription =
        params.get('error_description') ||
        params.get('error') ||
        hashParams.get('error_description') ||
        hashParams.get('error');

      if (oauthErrorDescription) {
        sessionError = new Error(oauthErrorDescription);
      }

      if (!sessionError && params.get('code')) {
        const exchangeResult = await supabase.auth.exchangeCodeForSession(params.get('code'));
        sessionData = exchangeResult.data;
        sessionError = exchangeResult.error;
      } else if (!sessionError && hashParams.get('access_token') && hashParams.get('refresh_token')) {
        const setSessionResult = await supabase.auth.setSession({
          access_token: hashParams.get('access_token'),
          refresh_token: hashParams.get('refresh_token'),
        });
        sessionData = setSessionResult.data;
        sessionError = setSessionResult.error;
      } else {
        sessionError = new Error('No auth code or tokens were returned by Supabase.');
      }

      if (sessionError || !sessionData?.session) {
        console.error('[auth/callback] exchange failed:', sessionError);
        setStatus('Sign-in failed. Redirecting...');
        const loginUrl = new URL('/login', window.location.origin);
        loginUrl.searchParams.set('error', 'oauth_failed');
        if (sessionError?.message) {
          loginUrl.searchParams.set('reason', sessionError.message.slice(0, 300));
        }
        setTimeout(() => {
          window.location.href = `${loginUrl.pathname}${loginUrl.search}`;
        }, 1500);
        return;
      }

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: sessionData.session.access_token, linkAccount: isLinkMode }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('[auth/callback] sync failed:', data);
        setStatus('Sign-in failed. Redirecting...');
        const loginUrl = new URL('/login', window.location.origin);
        loginUrl.searchParams.set('error', 'session_sync');
        if (data?.error) {
          loginUrl.searchParams.set('reason', String(data.error).slice(0, 300));
        }
        setTimeout(() => {
          window.location.href = `${loginUrl.pathname}${loginUrl.search}`;
        }, 1500);
        return;
      }

      const data = await response.json();
      setStatus('Signed in. Redirecting...');
      if (isLinkMode) {
        window.location.href = '/account?linked=1';
        return;
      }

      if (nextUrl && data.onboardingComplete) {
        window.location.href = nextUrl;
        return;
      }

      window.location.href = data.onboardingComplete ? '/dashboard' : '/onboarding';
    }

    handleCallback();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
      <div className="w-full max-w-sm rounded-[28px] border border-ink/10 bg-white px-8 py-8 text-center shadow-[0_8px_24px_rgba(19,24,22,0.06)]">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">Threshold</p>
        <div className="mx-auto mb-5 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-ink/60">{status}</p>
      </div>
    </main>
  );
}
