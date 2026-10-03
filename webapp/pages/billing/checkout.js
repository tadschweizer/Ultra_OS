import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

function formatPrice(price) {
  if (!price) return '';
  // Stripe uses minor units, except for its zero-decimal currencies.
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits;
  const amount = formatter.format(price.amount / 10 ** digits);
  return `${amount} / ${price.intervalCount > 1 ? `${price.intervalCount} ` : ''}${price.interval}${price.intervalCount > 1 ? 's' : ''}`;
}

export default function BillingReviewPage() {
  const router = useRouter();
  const plan = typeof router.query.plan === 'string' ? router.query.plan : '';
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    if (!router.isReady) return;
    const controller = new AbortController();
    setLoading(true);
    setReview(null);
    setError('');
    fetch(`/api/billing/preview?plan=${encodeURIComponent(plan)}`, { signal: controller.signal })
      .then(async res => {
        const data = await res.json();
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/billing/checkout?plan=${encodeURIComponent(plan)}`)}`);
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Unable to load billing details.');
        setReview(data);
      }).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [router.isReady, plan, refresh]);

  async function continueToStripe() {
    if (!review || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, intent: review.intent }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setReview(null);
        throw new Error(data.error || 'Unable to open secure billing.');
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || 'Unable to reach billing. Please try again.');
      submitting.current = false;
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-2xl px-4 py-8 md:py-14">
    <a href="/pricing" className="text-sm font-semibold text-ink">← Back to pricing</a>
    <section className="mt-6 rounded-[30px] border border-ink/10 bg-white p-6 shadow-sm md:p-10">
      <p className="text-xs uppercase tracking-[0.2em] text-ink">Billing review</p>
      <h1 className="font-display mt-3 text-3xl md:text-5xl">{review?.samePlan ? 'You already have this plan' : 'Review your plan'}</h1>
      {loading && <p role="status" className="mt-6 text-ink/70">Loading your current billing details…</p>}
      {router.query.cancelled && <p role="status" className="mt-4 text-ink/70">Checkout was cancelled. You can review the plan again when you’re ready.</p>}
      {review && <>
        <dl className="mt-8 space-y-5">
          {review.currentPrice && <div><dt className="text-sm text-ink/60">Current billing rate</dt><dd className="mt-1 font-semibold">{formatPrice(review.currentPrice)}</dd></div>}
          <div><dt className="text-sm text-ink/60">{review.changing ? 'Selected plan' : 'Your plan'}</dt><dd className="mt-1 text-xl font-semibold">{review.plan.label}</dd></div>
          <div><dt className="text-sm text-ink/60">Recurring price</dt><dd className="mt-1 text-2xl font-semibold">{formatPrice(review.price)}</dd></div>
        </dl>
        <div className="mt-7 rounded-2xl bg-paper p-5 text-sm leading-7 text-ink/80">
          {review.samePlan ? <p>You’re already on this billing plan. Open Stripe to manage your payment method or cancellation.</p>
            : review.changing ? <p>Stripe will show the exact amount due, any credit for unused time, and your next invoice before you confirm the change. Your plan stays as it is until you approve the change there.</p>
              : <p>This subscription renews automatically. Stripe will show your total, including any applicable taxes and discounts, before you confirm payment. You can manage or cancel your subscription from Account Settings.</p>}
        </div>
        <button type="button" disabled={busy} onClick={continueToStripe}
          className="mt-7 min-h-12 w-full rounded-full bg-ink px-6 py-3 font-semibold text-paper disabled:opacity-60">
          {busy ? 'Opening secure billing…' : review.samePlan ? 'Manage billing in Stripe' : 'Continue to Stripe for confirmation'}
        </button>
      </>}
      {error && <div className="mt-5"><p role="alert" className="text-sm leading-6 text-red-700">{error}</p>
        {!review && <button className="mt-3 min-h-11 font-semibold text-ink" onClick={() => setRefresh(n => n + 1)}>Review billing again</button>}
      </div>}
      <p className="mt-5 text-center text-xs leading-6 text-ink/70">Secure payment and subscription management by Stripe.</p>
    </section>
  </main>;
}
