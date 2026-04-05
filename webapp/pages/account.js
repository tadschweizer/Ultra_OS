import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import { createClient } from '@supabase/supabase-js';
import { usePlan } from '../lib/planUtils';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default function AccountPage() {
  const { planLabel, planId } = usePlan();
  const [coachCode, setCoachCode] = useState('');
  const [coachRole, setCoachRole] = useState('primary');
  const [coachConnections, setCoachConnections] = useState([]);
  const [coachMessage, setCoachMessage] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [billingMessage, setBillingMessage] = useState('');
  const [billingSyncing, setBillingSyncing] = useState(false);
  const navLinks = [
    { href: '/dashboard', label: 'Threshold Home' },
    { href: '/guide', label: 'Guide' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/connections', label: 'Connections' },
    { href: '/settings', label: 'Athlete Settings' },
    { href: '/account', label: 'Account' },
    { href: '/', label: 'Landing Page' },
  ];

  useEffect(() => {
    async function loadConnections() {
      const res = await fetch('/api/coach-connection');
      if (!res.ok) return;
      const data = await res.json();
      setCoachConnections(data.connections || []);
    }

    loadConnections();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const sessionId = params.get('session_id');
    const pendingCheckoutSession = document.cookie.match(/pending_checkout_session_id=([^;]+)/)?.[1];

    if (checkoutStatus === 'success' && sessionId) {
      syncBilling(sessionId);
    } else if (pendingCheckoutSession) {
      syncBilling();
    } else if (checkoutStatus === 'success') {
      setBillingMessage('Payment succeeded. Click "Refresh Billing Status" to pull the plan from Stripe.');
    }
  }, []);

  async function connectCoach(event) {
    event.preventDefault();
    setCoachMessage('');

    const res = await fetch('/api/coach-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coach_code: coachCode, role: coachRole }),
    });
    const data = await res.json();

    if (!res.ok) {
      setCoachMessage(data.error || 'Unable to connect coach.');
      return;
    }

    setCoachConnections((current) => [...current, data.connection]);
    setCoachCode('');
    setCoachMessage('Coach connected.');
  }

  async function disconnectCoach(id) {
    const res = await fetch(`/api/coach-connection?id=${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setCoachConnections((current) => current.filter((item) => item.id !== id));
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('[account] Supabase sign-out warning:', error);
    }

    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  async function syncBilling(sessionId = null) {
    setBillingSyncing(true);
    setBillingMessage(sessionId
      ? 'Confirming your purchase with Stripe and updating your account...'
      : 'Refreshing your billing status from Stripe...');

    try {
      const res = await fetch('/api/billing/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setBillingMessage(data.error || 'Billing sync failed.');
        return;
      }

      if (data.synced) {
        setBillingMessage('Your subscription is now synced. Reloading account details...');
        window.location.href = '/account?billing=updated';
        return;
      }

      setBillingMessage('Stripe did not return an active subscription for this account yet.');
    } catch (error) {
      console.error('[account] billing sync failed:', error);
      setBillingMessage('Could not reach Stripe to refresh billing status.');
    } finally {
      setBillingSyncing(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Account</p>
          <NavMenu label="Account navigation" links={navLinks} primaryLink={{ href: '/guide', label: 'Help', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/account"
          tabs={[
            { href: '/account', label: 'Account' },
            { href: '/guide', label: 'Guide' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/settings', label: 'Settings' },
          ]}
        />

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Account</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Manage your account</h1>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Plan</p>
            <p className="mt-4 text-2xl font-semibold text-ink">{planLabel}</p>
            <p className="mt-4 text-sm leading-7 text-ink/76">
              Your current subscription tier is stored on your athlete profile and powers app access everywhere else in Threshold.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink/45">Tier code: {planId}</p>
            <a href="/pricing" className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
              View Pricing
            </a>
            {planId !== 'free' ? (
              <a href="/api/billing/portal" className="mt-3 inline-flex rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink">
                Manage Billing
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => syncBilling()}
              disabled={billingSyncing}
              className="mt-3 inline-flex rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {billingSyncing ? 'Refreshing Billing...' : 'Refresh Billing Status'}
            </button>
            {billingMessage ? (
              <p className="mt-3 text-sm leading-6 text-ink/70">{billingMessage}</p>
            ) : null}
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Help</p>
            <p className="mt-4 text-sm leading-7 text-ink/76">
              Open the guide whenever you want a refresher on logging, race setup, insights, the explorer, or the coach dashboard.
            </p>
            <a href="/guide" className="mt-5 inline-flex rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink">
              Open Guide
            </a>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-3 inline-flex rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {loggingOut ? 'Logging out...' : 'Log Out'}
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Coach Connection</p>
            <p className="mt-4 text-sm leading-7 text-ink/76">
              Enter a coach code to connect a primary or secondary coach to your account.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink/45">Coach role</p>
            <form onSubmit={connectCoach} className="mt-5 space-y-4">
              <input
                type="text"
                value={coachCode}
                onChange={(event) => setCoachCode(event.target.value)}
                placeholder="Enter coach code"
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
              />
              <select
                value={coachRole}
                onChange={(event) => setCoachRole(event.target.value)}
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
              >
                <option value="primary">Primary Coach</option>
                <option value="secondary">Secondary Coach</option>
              </select>
              <button type="submit" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
                Connect Coach
              </button>
            </form>
            {coachMessage ? <p className="mt-4 text-sm text-ink/70">{coachMessage}</p> : null}
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Connected Coaches</p>
            <div className="mt-5 space-y-3">
              {coachConnections.length ? coachConnections.map((connection) => (
                <div key={connection.id} className="rounded-[22px] bg-paper p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{connection.coach?.display_name || 'Coach'}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/55">{connection.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => disconnectCoach(connection.id)}
                      className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] bg-paper p-4 text-sm text-ink/70">
                  No coaches connected yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
