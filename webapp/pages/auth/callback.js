import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Processing your sign-in...');

  useEffect(() => {
    async function handleCallback() {
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (sessionError || !sessionData?.session) {
        console.error('[auth/callback] exchange failed:', sessionError);
        setStatus('Sign-in failed. Redirecting...');
        setTimeout(() => {
          window.location.href = '/login?error=oauth_failed';
        }, 1500);
        return;
      }

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: sessionData.session.access_token }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('[auth/callback] sync failed:', data);
        setStatus('Sign-in failed. Redirecting...');
        setTimeout(() => {
          window.location.href = '/login?error=session_sync';
        }, 1500);
        return;
      }

      const data = await response.json();
      setStatus('Signed in. Redirecting...');
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
