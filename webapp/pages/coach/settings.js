import { useEffect, useMemo, useState } from 'react';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusBadgeClass(status) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800';
  if (status === 'past_due') return 'bg-amber-100 text-amber-900';
  if (status === 'cancelled') return 'bg-red-100 text-red-800';
  return 'bg-stone-200 text-stone-700';
}

function statusLabel(status) {
  if (!status) return 'Inactive';
  return status.replace('_', ' ');
}

function renewalLabel(profile) {
  if (!profile?.subscription_current_period_end) {
    return 'No renewal date yet';
  }

  if (profile.subscription_status === 'cancelled') {
    return `Expires on ${formatDate(profile.subscription_current_period_end)}`;
  }

  return `Renews on ${formatDate(profile.subscription_current_period_end)}`;
}

export default function CoachSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/coach/subscription?force=1');
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Could not load coach billing.');
        }

        if (!cancelled) {
          setData(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
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
  }, []);

  async function switchPlan(planId) {
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/coach/billing/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Could not switch billing plan.');
      }

      const refreshed = await fetch('/api/coach/subscription?force=1');
      const refreshedPayload = await refreshed.json();
      if (!refreshed.ok) {
        throw new Error(refreshedPayload.error || 'Could not refresh coach billing.');
      }

      setData(refreshedPayload);
    } catch (switchError) {
      setError(switchError.message);
    } finally {
      setSaving(false);
    }
  }

  const seatFillWidth = useMemo(() => {
    const ratio = data?.seats?.usageRatio || 0;
    return `${Math.min(100, Math.round(ratio * 100))}%`;
  }, [data]);

  if (loading) {
    return (
      <main className="ui-shell text-ink">
        <div className="ui-card">
          <p className="text-sm text-ink/60">Loading coach billing...</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="ui-shell text-ink">
        <div className="ui-card">
          <p className="text-sm text-red-700">{error || 'Coach billing could not be loaded.'}</p>
        </div>
      </main>
    );
  }

  const { profile, plan, seats } = data;
  const otherPlanId = profile.subscription_tier === 'coach_annual' ? 'coach_monthly' : 'coach_annual';
  const otherPlanLabel = otherPlanId === 'coach_annual' ? 'Switch to annual' : 'Switch to monthly';

  return (
    <main className="ui-shell text-ink">
      <section className="ui-hero">
        <p className="ui-eyebrow">Coach billing</p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">Coach Settings</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/68">
          Keep billing simple: one flat coach plan, up to 25 athletes, no per-athlete fees.
        </p>
      </section>

      {error ? (
        <section className="ui-section">
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            {error}
          </div>
        </section>
      ) : null}

      <section className="ui-section grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="ui-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Current plan</p>
              <h2 className="mt-3 text-3xl font-semibold text-ink">{plan.label}</h2>
              <p className="mt-2 text-sm text-ink/62">{plan.priceLabel}</p>
              <p className="mt-4 text-sm leading-7 text-ink/68">{renewalLabel(profile)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(profile.subscription_status)}`}>
              {statusLabel(profile.subscription_status)}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[20px] bg-paper p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Billing cadence</p>
              <p className="mt-2 text-lg font-semibold text-ink">{plan.cycleLabel}</p>
            </div>
            <div className="rounded-[20px] bg-paper p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Stripe customer</p>
              <p className="mt-2 text-sm font-medium text-ink/75">
                {profile.stripe_customer_id ? 'Connected' : 'Waiting for first checkout'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/api/coach/billing/portal" className="ui-button-primary">
              Manage Subscription
            </a>
            <button
              type="button"
              onClick={() => switchPlan(otherPlanId)}
              disabled={saving || !profile.stripe_subscription_id}
              className="ui-button-secondary disabled:opacity-50"
            >
              {saving ? 'Switching...' : otherPlanLabel}
            </button>
          </div>
        </div>

        <div className="ui-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Athlete seats</p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">
            {seats.activeSeats} of {seats.maxSeats} athlete seats used
          </h2>
          <div className="mt-5 h-4 overflow-hidden rounded-full bg-ink">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: seatFillWidth }}
            />
          </div>
          <p className="mt-4 text-sm leading-7 text-ink/68">
            Removing an athlete frees a seat automatically.
          </p>
          {seats.approachingLimit ? (
            <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-950">
              You&apos;re getting close to the 25-athlete limit. Contact us if you need an enterprise roster with more seats.
            </div>
          ) : null}
        </div>
      </section>

      <section className="ui-section grid gap-6 lg:grid-cols-2">
        <div className="ui-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Coach tier includes</p>
          <ul className="mt-5 space-y-3 text-sm text-ink/72">
            <li>Everything in Individual, plus:</li>
            <li>Multi-athlete dashboard</li>
            <li>Protocol assignment</li>
            <li>Cohort comparison</li>
            <li>Compliance tracking</li>
            <li>Private coach notes</li>
            <li>Up to 25 athletes</li>
            <li>No per-athlete fees</li>
          </ul>
        </div>

        <div className="ui-card-dark">
          <p className="text-xs uppercase tracking-[0.18em] text-white/55">Why this pricing matters</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">One flat coach price.</h2>
          <p className="mt-4 text-sm leading-7 text-white/72">
            TrainingPeaks charges $22-55/month plus $9/athlete/month. Threshold keeps it simple: one flat price for up to 25 athletes.
          </p>
          <a href="/pricing" className="mt-6 inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white">
            View full pricing
          </a>
        </div>
      </section>
    </main>
  );
}
