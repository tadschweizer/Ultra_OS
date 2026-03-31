import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/**
 * /auth/callback
 *
 * Client-side page that handles the Supabase OAuth redirect (Google, etc.).
 * Supabase redirects here after Google auth completes with a `code` param.
 * We exchange it for a session, then POST to /api/auth/session to:
 *   1. Verify the token server-side
 *   2. Create or link the athlete record
 *   3. Set the athlete_id cookie
 * Then redirect to onboarding (new user) or dashboard (returning user).
 */
export default function AuthCallback() {
  const [status, setStatus] = useState('Processing your sign-in…');

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      // Exchange the URL code for a Supabase session (PKCE flow)
      const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (sessionError || !sessionData?.session) {
        console.error('[auth/callback] Session exchange failed:', sessionError);
        setStatus('Sign-in failed. Redirecting…');
        setTimeout(() => { window.location.href = '/login?error=oauth_failed'; }, 2000);
        return;
      }

      const accessToken = sessionData.session.access_token;
      const provider = sessionData.session.user?.app_metadata?.provider || 'google';

      // POST to server to create/fetch athlete and set the cookie
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, provider }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error('[auth/callback] Session sync failed:', data);
        setStatus('Sign-in failed. Redirecting…');
        setTimeout(() => { window.location.href = '/login?error=session_sync'; }, 2000);
        return;
      }

      const { onboardingComplete, isNewAthlete } = await res.json();
      setStatus('Signed in! Redirecting…');

      if (isNewAthlete || !onboardingComplete) {
        window.location.href = '/onboarding';
      } else {
        window.location.href = '/dashboard';
      }
    }

    handleCallback();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper text-ink px-4">
      <div className="rounded-[28px] border border-ink/10 bg-white px-8 py-8 text-center shadow-[0_8px_24px_rgba(19,24,22,0.06)] max-w-sm w-full">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent mb-4">UltraOS</p>
        <div className="flex justify-center mb-5">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-ink/60">{status}</p>
      </div>
    </main>
  );
}
