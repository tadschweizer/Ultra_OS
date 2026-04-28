import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

function fieldClassName() {
  return 'ui-input min-h-[48px] rounded-xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink/35';
}

export default function CoachInvitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState(null);
  const [coach, setCoach] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (!router.isReady || !router.query.token) return;

    let cancelled = false;

    async function load() {
      try {
        const [inviteResponse, meResponse] = await Promise.all([
          fetch(`/api/coach/invitations/${router.query.token}`),
          fetch('/api/me'),
        ]);

        if (!inviteResponse.ok) {
          const data = await inviteResponse.json().catch(() => ({}));
          if (!cancelled) {
            setMessage(data.error || 'Invite not found.');
          }
          return;
        }

        const inviteData = await inviteResponse.json();
        if (cancelled) return;

        setInvite(inviteData.invitation);
        setCoach(inviteData.coach);
        setForm((current) => ({
          ...current,
          email: inviteData.invitation?.email || current.email,
        }));

        if (meResponse.ok) {
          const meData = await meResponse.json();
          setAthlete(meData.athlete || null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.token]);

  async function acceptInvite() {
    setAccepting(true);
    setMessage('');

    try {
      const response = await fetch(`/api/coach/invitations/${router.query.token}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not accept invite.');
      }

      window.location.href = data.redirectTo;
    } catch (error) {
      setMessage(error.message);
      setAccepting(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setAccepting(true);
    setMessage('');

    try {
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const signupData = await signupResponse.json();

      if (!signupResponse.ok) {
        throw new Error(signupData.error || 'Could not create your account.');
      }

      const acceptResponse = await fetch(`/api/coach/invitations/${router.query.token}`, {
        method: 'POST',
      });
      const acceptData = await acceptResponse.json();

      if (!acceptResponse.ok) {
        throw new Error(acceptData.error || 'Account created, but the invite could not be accepted.');
      }

      window.location.href = acceptData.redirectTo;
    } catch (error) {
      setMessage(error.message);
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
        <div className="rounded-[32px] border border-ink/10 bg-white px-6 py-5 text-sm text-ink/70 shadow-[0_12px_30px_rgba(19,24,22,0.05)]">
          Checking invitation...
        </div>
      </main>
    );
  }

  if (!invite || !coach) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
        <div className="max-w-md rounded-[36px] border border-ink/10 bg-white p-8 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Invitation unavailable</p>
          <h1 className="font-display mt-4 text-3xl text-ink">This link cannot be used</h1>
          <p className="mt-4 text-sm leading-7 text-ink/68">{message || 'Ask your coach to send a fresh invite link.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8 text-ink">
      <div className="mx-auto max-w-5xl">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(140deg,#1b2421_0%,#26332f_42%,#857056_100%)] p-8 text-white shadow-[0_20px_40px_rgba(19,24,22,0.12)] md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Coach invitation</p>
            <h1 className="font-display mt-4 text-4xl leading-tight md:text-6xl">
              {coach.display_name} wants to coach you inside Threshold.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74">
              Accept the invitation to connect your athlete account. Once accepted, your coach can assign protocols and review your progress from their coaching dashboard.
            </p>
            <div className="mt-8 rounded-[26px] border border-white/12 bg-white/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Invite details</p>
              <p className="mt-3 text-sm text-white/78">Sent to: {invite.email || 'Any email on your account'}</p>
              <p className="mt-2 text-sm text-white/78">Expires: {new Date(invite.expires_at).toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-[36px] border border-ink/10 bg-white p-8 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            {athlete ? (
              <>
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Accept invitation</p>
                <h2 className="font-display mt-4 text-3xl text-ink">You already have a Threshold account</h2>
                <p className="mt-4 text-sm leading-7 text-ink/68">
                  Click once to connect your account to {coach.display_name}. You will go straight to your dashboard after acceptance.
                </p>
                <button
                  type="button"
                  onClick={acceptInvite}
                  disabled={accepting}
                  className="mt-8 ui-button-primary w-full justify-center disabled:opacity-50"
                >
                  {accepting ? 'Accepting...' : 'Accept Invitation'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Create athlete account</p>
                <h2 className="font-display mt-4 text-3xl text-ink">Sign up and accept automatically</h2>
                <p className="mt-4 text-sm leading-7 text-ink/68">
                  Fill in the form below. Threshold will create your account and immediately connect it to {coach.display_name}.
                </p>
                <form onSubmit={handleSignup} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className={fieldClassName()}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className={fieldClassName()}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      className={fieldClassName()}
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={accepting}
                    className="ui-button-primary mt-2 w-full justify-center disabled:opacity-50"
                  >
                    {accepting ? 'Creating account...' : 'Create Account and Accept'}
                  </button>
                </form>
                <p className="mt-4 text-sm text-ink/58">
                  Already have an account?{' '}
                  <a href={`/login?next=${encodeURIComponent(`/invite/${router.query.token}`)}`} className="font-semibold text-accent">
                    Log in first
                  </a>
                </p>
              </>
            )}

            {message ? (
              <div className="mt-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {message}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
