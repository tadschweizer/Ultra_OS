import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import { planOptions, usePlan } from '../lib/planUtils';

export default function AccountPage() {
  const { planId, setPlanId, planLabel } = usePlan();
  const [coachCode, setCoachCode] = useState('');
  const [coachRole, setCoachRole] = useState('primary');
  const [coachConnections, setCoachConnections] = useState([]);
  const [coachMessage, setCoachMessage] = useState('');
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home' },
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
            <label className="mt-5 block text-sm font-semibold text-ink">Preview plan tier</label>
            <select value={planId} onChange={(event) => setPlanId(event.target.value)} className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink">
              {planOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label} · {plan.price}
                </option>
              ))}
            </select>
            <a href="/pricing" className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
              View Pricing
            </a>
          </div>

          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Help</p>
            <p className="mt-4 text-sm leading-7 text-ink/76">
              Open the guide whenever you want a refresher on logging, race setup, insights, the explorer, or the coach dashboard.
            </p>
            <a href="/guide" className="mt-5 inline-flex rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink">
              Open Guide
            </a>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Coach Connection</p>
            <p className="mt-4 text-sm leading-7 text-ink/76">
              Enter a coach code to connect a primary or secondary coach to your account.
            </p>
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
