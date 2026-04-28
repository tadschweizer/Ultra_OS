import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';

const specialtyOptions = [
  'Ultrarunning',
  'Gravel',
  'Triathlon',
  'Trail Running',
  'Road Cycling',
  'Other',
];

const planCards = [
  {
    id: 'coach_monthly',
    title: 'Coach Monthly',
    price: '$59.99',
    cadence: '/month',
    summary: 'Flat monthly billing for up to 25 athletes. No per-athlete fees.',
  },
  {
    id: 'coach_annual',
    title: 'Coach Annual',
    price: '$509.99',
    cadence: '/year',
    eyebrow: 'Best Value',
    summary: 'The same flat coach plan billed annually. Save $209.89/year and keep up to 25 athletes.',
  },
];

function fieldClassName() {
  return 'ui-input min-h-[48px] rounded-xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink/35';
}

function StepHeader({ step }) {
  const progress = `${(step / 3) * 100}%`;
  return (
    <div className="rounded-[28px] border border-ink/10 bg-white p-5 shadow-[0_12px_30px_rgba(19,24,22,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">Coach onboarding</p>
          <p className="mt-2 text-lg font-semibold text-ink">Step {step} of 3</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((item) => (
            <span
              key={item}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${
                item === step ? 'bg-panel text-paper' : 'bg-paper text-ink/45'
              }`}
            >
              {item === 1 ? 'Coaching' : item === 2 ? 'Plan' : 'Invite'}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: progress }}
        />
      </div>
    </div>
  );
}

function uploadFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export default function CoachSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingSyncing, setBillingSyncing] = useState(false);
  const [step, setStep] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [athlete, setAthlete] = useState(null);
  const [coachProfile, setCoachProfile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [seatLimitModalOpen, setSeatLimitModalOpen] = useState(false);
  const [seatLimitSnapshot, setSeatLimitSnapshot] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteState, setInviteState] = useState(null);
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    specialties: [],
    certifications: '',
    avatar_url: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);
  const inviteLink = inviteState?.inviteUrl || '';
  const bioCount = form.bio.length;

  const stepFromQuery = useMemo(() => {
    const raw = Number(router.query.step || 0);
    return raw >= 1 && raw <= 3 ? raw : 0;
  }, [router.query.step]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [meResponse, setupResponse] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/coach/setup'),
        ]);

        if (!meResponse.ok) {
          setLoading(false);
          return;
        }

        const meData = await meResponse.json();
        const setupData = setupResponse.ok ? await setupResponse.json() : {};

        if (cancelled) return;

        setAthlete(meData.athlete || null);
        setCoachProfile(setupData.profile || null);
        setForm({
          display_name: setupData.profile?.display_name || meData.athlete?.name || '',
          bio: setupData.profile?.bio || '',
          specialties: setupData.profile?.specialties || [],
          certifications: Array.isArray(setupData.profile?.certifications)
            ? setupData.profile.certifications.join(', ')
            : '',
          avatar_url: setupData.profile?.avatar_url || '',
        });

        const nextStep = stepFromQuery
          || (setupData.profile?.onboarding_completed
            ? (meData.athlete?.subscription_tier === 'coach' ? 3 : 2)
            : 1);
        setStep(nextStep);
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
  }, [stepFromQuery]);

  useEffect(() => {
    async function syncBillingIfNeeded() {
      if (!router.isReady || !router.query.session_id) return;

      setBillingSyncing(true);
      setStatusMessage('Confirming your coach subscription with Stripe...');

      try {
        const response = await fetch('/api/billing/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: router.query.session_id }),
        });
        const data = await response.json();

        if (!response.ok || !data.synced) {
          setStatusMessage(data.error || 'Stripe checkout finished, but the billing sync has not completed yet.');
          return;
        }

        setAthlete((current) => ({
          ...(current || {}),
          ...data.athlete,
        }));
        setStatusMessage('Subscription connected. You can invite your first athlete now.');
        setStep(3);
      } catch (error) {
        console.error('[coach/setup] billing sync failed:', error);
        setStatusMessage('Could not confirm billing status yet.');
      } finally {
        setBillingSyncing(false);
      }
    }

    syncBillingIfNeeded();
  }, [router.isReady, router.query.session_id]);

  function goToStep(nextStep) {
    setTransitioning(true);
    window.setTimeout(() => {
      setStep(nextStep);
      router.replace(
        {
          pathname: '/coach/setup',
          query: { step: nextStep },
        },
        undefined,
        { shallow: true }
      );
      setTransitioning(false);
    }, 160);
  }

  async function uploadAvatarIfNeeded() {
    if (!avatarFile) {
      return form.avatar_url || null;
    }

    const base64Data = await uploadFileAsBase64(avatarFile);
    const response = await fetch('/api/coach/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: avatarFile.name,
        contentType: avatarFile.type,
        base64Data,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not upload avatar.');
    }

    return data.avatarUrl;
  }

  async function saveStepOne(onboardingCompleted = false) {
    setSaving(true);
    setStatusMessage('');

    try {
      const avatarUrl = await uploadAvatarIfNeeded();
      const response = await fetch('/api/coach/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: form.display_name,
          bio: form.bio,
          specialties: form.specialties,
          certifications: form.certifications,
          avatar_url: avatarUrl,
          onboarding_completed: onboardingCompleted,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not save coach profile.');
      }

      setCoachProfile(data.profile);
      setForm((current) => ({
        ...current,
        avatar_url: data.profile.avatar_url || current.avatar_url,
      }));
      setAvatarFile(null);
      return true;
    } catch (error) {
      setStatusMessage(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleStepOneContinue() {
    const ok = await saveStepOne(true);
    if (ok) {
      goToStep(2);
    }
  }

  function startCheckout(planId) {
    const success = encodeURIComponent('/coach/setup?step=3&checkout=success');
    const cancel = encodeURIComponent('/coach/setup?step=2&checkout=cancelled');
    window.location.href = `/api/billing/checkout?plan=${planId}&success=${success}&cancel=${cancel}`;
  }

  async function sendInvite() {
    setSaving(true);
    setStatusMessage('');
    setSeatLimitModalOpen(false);
    setSeatLimitSnapshot(null);

    try {
      const response = await fetch('/api/coach/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data?.seatSnapshot) {
          setSeatLimitSnapshot(data.seatSnapshot);
          setSeatLimitModalOpen(true);
        }
        throw new Error(data.error || 'Could not send invite.');
      }

      setInviteState(data);
      if (data.emailDelivery?.sent) {
        setStatusMessage('Invite email sent. You can also copy the link below if you want to send it manually.');
      } else if (data.emailDelivery?.skipped) {
        setStatusMessage('Invite link generated, but email sending is not configured yet. Copy the link below and send it manually.');
      } else if (data.emailDelivery?.error) {
        setStatusMessage(`${data.emailDelivery.error} You can still copy the link below and send it manually.`);
      } else {
        setStatusMessage('Invite link generated. Copy it and send it to your athlete.');
      }
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setStatusMessage('Invite link copied to clipboard.');
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-paper px-4 py-8 text-ink">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[32px] border border-ink/10 bg-white px-6 py-8 text-sm text-ink/65 shadow-[0_12px_30px_rgba(19,24,22,0.05)]">
            Loading coach setup...
          </div>
        </div>
      </main>
    );
  }

  if (!athlete) {
    return (
      <main className="min-h-screen bg-paper px-4 py-8 text-ink">
        <div className="mx-auto max-w-3xl rounded-[36px] border border-ink/10 bg-white p-8 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Coach onboarding</p>
          <h1 className="font-display mt-4 text-4xl text-ink">Sign in first</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/70">
            This setup flow lives inside your Threshold account. Open your login or signup page first, then come back here.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/login?next=/coach/setup" className="ui-button-primary">Log In</a>
            <a href="/signup" className="ui-button-secondary">Create Account</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8 text-ink">
      <div className="mx-auto max-w-5xl">
        {seatLimitModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4"
            onClick={() => setSeatLimitModalOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_24px_60px_rgba(19,24,22,0.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Seat limit reached</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">You&apos;ve reached your 25-athlete limit.</h2>
              <p className="mt-4 text-sm leading-7 text-ink/68">
                Contact us to add more seats. Your current roster is using {seatLimitSnapshot?.activeSeats || 25} of {seatLimitSnapshot?.maxSeats || 25} seats.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="/coach/settings" className="ui-button-primary">Open Coach Settings</a>
                <button
                  type="button"
                  onClick={() => setSeatLimitModalOpen(false)}
                  className="ui-button-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(140deg,#1b2421_0%,#26332f_42%,#857056_100%)] p-6 text-white md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Threshold coaching</p>
              <h1 className="font-display mt-4 text-4xl leading-tight md:text-6xl">
                Create a premium coaching workspace that feels effortless from the first click.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74">
                Set your profile, connect your subscription, and invite your first athlete without leaving the flow.
              </p>
            </div>
            <StepHeader step={step} />
          </div>
        </section>

        {statusMessage ? (
          <div className="mt-5 rounded-[22px] border border-accent/20 bg-white px-5 py-4 text-sm text-ink/72 shadow-[0_8px_24px_rgba(19,24,22,0.04)]">
            {statusMessage}
          </div>
        ) : null}

        <section
          className={`mt-6 rounded-[34px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)] transition-opacity duration-200 md:p-8 ${
            transitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {step === 1 ? (
            <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-accent">Step 1/3</p>
                <h2 className="font-display mt-3 text-3xl text-ink">Tell us about your coaching</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-ink/68">
                  This becomes the profile athletes see when they accept your invitation.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Display name</label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                    className={fieldClassName()}
                    placeholder="Example: Coach Taylor Bennett"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Bio</label>
                    <span className="text-xs text-ink/45">{bioCount}/500</span>
                  </div>
                  <textarea
                    rows={5}
                    maxLength={500}
                    value={form.bio}
                    onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                    className={`${fieldClassName()} min-h-[140px]`}
                    placeholder="Tell athletes how you coach, who you work best with, and what your approach feels like."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Specialties</label>
                  <div className="flex flex-wrap gap-2">
                    {specialtyOptions.map((option) => {
                      const active = form.specialties.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setForm((current) => ({
                            ...current,
                            specialties: active
                              ? current.specialties.filter((item) => item !== option)
                              : [...current.specialties, option],
                          }))}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? 'bg-panel text-paper'
                              : 'border border-ink/10 bg-paper text-ink hover:bg-surface-light'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Certifications</label>
                  <input
                    type="text"
                    value={form.certifications}
                    onChange={(event) => setForm((current) => ({ ...current, certifications: event.target.value }))}
                    className={fieldClassName()}
                    placeholder="USAT Level II, UESCA, RRCA"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Avatar upload (optional)</label>
                  <div className="flex items-center gap-4 rounded-[24px] border border-dashed border-ink/12 bg-paper px-4 py-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white">
                      {form.avatar_url ? (
                        <img src={form.avatar_url} alt="Coach avatar" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink/35">Avatar</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{avatarFile ? avatarFile.name : 'Upload a profile image'}</p>
                      <p className="mt-1 text-xs leading-5 text-ink/52">JPG, PNG, or WebP up to 5 MB. Stored in Supabase Storage.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="ui-button-secondary"
                    >
                      Choose File
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setAvatarFile(file);
                        if (file) {
                          setForm((current) => ({
                            ...current,
                            avatar_url: URL.createObjectURL(file),
                          }));
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.24em] text-accent">Step 2/3</p>
                <h2 className="font-display mt-3 text-3xl text-ink">Choose your plan</h2>
                <p className="mt-3 text-sm leading-7 text-ink/68">
                  One flat coach plan, two billing cadences. Pick monthly or annual and coach up to 25 athletes without per-athlete fees.
                </p>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                {planCards.map((plan) => (
                  <article
                    key={plan.id}
                    className={`relative rounded-xl border bg-white p-6 shadow-sm ${
                      plan.eyebrow ? 'border-accent/25 ring-1 ring-accent/12' : 'border-ink/10'
                    }`}
                  >
                    {plan.eyebrow ? (
                      <span className="absolute right-5 top-5 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                        {plan.eyebrow}
                      </span>
                    ) : null}
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Threshold coach</p>
                    <h3 className="mt-3 text-2xl font-semibold text-ink">{plan.title}</h3>
                    <div className="mt-4 flex items-end gap-1">
                      <span className="text-4xl font-semibold text-ink">{plan.price}</span>
                      <span className="pb-1 text-sm text-ink/55">{plan.cadence}</span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-ink/68">{plan.summary}</p>
                    <button
                      type="button"
                      onClick={() => startCheckout(plan.id)}
                      className="mt-8 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(184,117,42,0.24)]"
                    >
                      Subscribe
                    </button>
                  </article>
                ))}
              </div>

              {athlete?.subscription_tier === 'coach' ? (
                <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                  Your account already has an active coach subscription. You can move straight to invitations.
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-accent">Step 3/3</p>
                <h2 className="font-display mt-3 text-3xl text-ink">Invite your first athlete</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-ink/68">
                  Generate a private invitation link. When the athlete accepts it, Threshold will connect them to your coaching workspace automatically.
                </p>
                {athlete?.subscription_tier !== 'coach' ? (
                  <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                    Your coach subscription still needs to be active before invites can be sent. If you just finished checkout, give Stripe a moment and refresh this page.
                  </div>
                ) : null}
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Athlete email</label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      className={fieldClassName()}
                      placeholder="athlete@example.com"
                      disabled={athlete?.subscription_tier !== 'coach'}
                    />
                    <button
                      type="button"
                      onClick={sendInvite}
                      disabled={!inviteEmail || saving || athlete?.subscription_tier !== 'coach'}
                      className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {saving ? 'Sending...' : 'Send Invite'}
                    </button>
                  </div>
                </div>

                {inviteLink ? (
                  <div className="rounded-[24px] border border-ink/10 bg-paper p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Generated link</p>
                    <div className="mt-3 rounded-[18px] border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink/70">
                      {inviteLink}
                    </div>
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      className="mt-4 rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => router.push('/coach/dashboard')}
                  className="text-sm font-semibold text-ink/60 underline underline-offset-4"
                >
                  Skip for now
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-ink/8 pt-6">
            <button
              type="button"
              onClick={() => goToStep(Math.max(1, step - 1))}
              className={`ui-button-secondary ${step === 1 ? 'invisible' : ''}`}
            >
              Back
            </button>

            {step === 1 ? (
              <button
                type="button"
                onClick={handleStepOneContinue}
                disabled={saving || !form.display_name.trim()}
                className="ui-button-primary disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Continue to Plan'}
              </button>
            ) : null}

            {step === 2 ? (
              <button
                type="button"
                onClick={() => goToStep(3)}
                disabled={billingSyncing}
                className="ui-button-primary disabled:opacity-50"
              >
                Continue to Invite
              </button>
            ) : null}

            {step === 3 ? (
              <button
                type="button"
                onClick={() => router.push('/coach/dashboard')}
                className="ui-button-primary"
              >
                Complete Setup
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
