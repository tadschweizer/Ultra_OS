import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

const sportOptions = [
  'Ultrarunner',
  'Trail Runner',
  'Marathoner',
  'Half Marathoner',
  'Road Racer (5K-10K)',
  'Gravel Cyclist',
  'Long-Course Triathlete',
];

const yearsOptions = ['1', '2-3', '4-6', '7+'];
const hoursOptions = ['<8', '8-12', '12-16', '16-20', '20+'];
const stepLabels = ['Your Race', 'Your Sport', 'Connect Data'];

function fieldClassName() {
  return 'w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-ink';
}

function StepIndicator({ step }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-full bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-paper">
        Step {step} of 3
      </span>
      {stepLabels.map((label, index) => (
        <span
          key={label}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
            index + 1 === step ? 'bg-white text-ink' : 'bg-white/50 text-ink/52'
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [manualRace, setManualRace] = useState(false);
  const [stravaName, setStravaName] = useState('');
  const [form, setForm] = useState({
    target_race_id: '',
    target_race: null,
    primary_sports: [],
    years_racing_band: '',
    weekly_training_hours_band: '',
    home_elevation_ft: '',
  });

  useEffect(() => {
    async function loadOnboarding() {
      try {
        const res = await fetch('/api/onboarding');
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setForm({
          target_race_id: data.targetRace?.id || '',
          target_race: data.targetRace
            ? {
                name: data.targetRace.name,
                event_date: data.targetRace.event_date,
                distance_miles: data.targetRace.distance_miles || '',
                location: data.targetRace.location || '',
                race_type: data.targetRace.race_type || '',
              }
            : null,
          primary_sports: data.athlete?.primary_sports || [],
          years_racing_band: data.athlete?.years_racing_band || '',
          weekly_training_hours_band: data.athlete?.weekly_training_hours_band || '',
          home_elevation_ft: data.athlete?.home_elevation_ft ?? '',
        });
        if (router.query.name) {
          setStravaName(String(router.query.name));
        }
      } finally {
        setLoading(false);
      }
    }

    loadOnboarding();
  }, [router.query.name]);

  useEffect(() => {
    if (!manualRace && catalogQuery.trim().length < 2) {
      setCatalogResults([]);
      return;
    }

    let cancelled = false;
    async function searchCatalog() {
      const res = await fetch(`/api/race-catalog?q=${encodeURIComponent(catalogQuery.trim())}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) {
        setCatalogResults(data.races || []);
      }
    }

    const id = setTimeout(searchCatalog, 180);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [catalogQuery, manualRace]);

  useEffect(() => {
    if (!navigator.geolocation || form.home_elevation_ft) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (position.coords.altitude !== null && position.coords.altitude !== undefined) {
          setForm((current) => ({
            ...current,
            home_elevation_ft: Math.round(position.coords.altitude * 3.28084),
          }));
        }
      },
      () => {}
    );
  }, [form.home_elevation_ft]);

  const slides = useMemo(
    () => [
      <section key="race" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Your next target</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Set your target race.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/76">
            Search the catalog first. If your event is not there, add it manually and keep moving.
          </p>
        </div>

        <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <label className="mb-2 block text-sm font-semibold text-ink">Search race catalog</label>
          <input
            type="text"
            value={catalogQuery}
            onChange={(event) => {
              setManualRace(false);
              setCatalogQuery(event.target.value);
            }}
            placeholder="Western States 100"
            className={fieldClassName()}
          />
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
            {catalogResults.map((race) => (
              <button
                key={race.id}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    target_race_id: '',
                    target_race: {
                      name: race.name,
                      event_date: race.event_date,
                      distance_miles: race.distance_miles,
                      location: [race.city, race.state, race.country].filter(Boolean).join(', '),
                      race_type: race.sport_type,
                    },
                  }))
                }
                className="w-full rounded-[22px] border border-ink/10 bg-paper px-4 py-3 text-left transition hover:bg-[#efe7dc]"
              >
                <p className="text-sm font-semibold text-ink">{race.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-accent">{race.sport_type}</p>
                <p className="mt-2 text-sm text-ink/64">
                  {race.event_date} · {[race.city, race.state, race.country].filter(Boolean).join(', ')} · {race.distance_miles} mi
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setManualRace((current) => !current);
                setCatalogResults([]);
              }}
              className="text-sm font-semibold text-accent"
            >
              {manualRace ? 'Hide manual race entry' : 'Race not listed? Enter it manually'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm((current) => ({ ...current, target_race_id: '', target_race: null }));
                setStep(2);
              }}
              className="text-sm font-semibold text-ink/62"
            >
              I’ll add my race later
            </button>
          </div>

          {manualRace ? (
            <div className="mt-5 grid gap-4">
              <input
                type="text"
                placeholder="Race name"
                value={form.target_race?.name || ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    target_race_id: '',
                    target_race: { ...(current.target_race || {}), name: event.target.value },
                  }))
                }
                className={fieldClassName()}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="date"
                  value={form.target_race?.event_date || ''}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      target_race_id: '',
                      target_race: { ...(current.target_race || {}), event_date: event.target.value },
                    }))
                  }
                  className={fieldClassName()}
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Distance (mi)"
                  value={form.target_race?.distance_miles || ''}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      target_race_id: '',
                      target_race: { ...(current.target_race || {}), distance_miles: event.target.value },
                    }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <input
                type="text"
                placeholder="Location"
                value={form.target_race?.location || ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    target_race_id: '',
                    target_race: { ...(current.target_race || {}), location: event.target.value },
                  }))
                }
                className={fieldClassName()}
              />
            </div>
          ) : null}

          {form.target_race ? (
            <div className="mt-5 rounded-[24px] bg-paper p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Selected race</p>
              <p className="mt-2 text-lg font-semibold text-ink">{form.target_race.name}</p>
              <p className="mt-2 text-sm text-ink/68">
                {form.target_race.event_date} · {form.target_race.location || 'Location needed'} · {form.target_race.distance_miles || 'Distance needed'} mi
              </p>
            </div>
          ) : null}
        </div>
      </section>,
      <section key="sport" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Your background</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Tell Threshold how you train.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/76">
            This gives the dashboard and future insights the context they need from day one.
          </p>
        </div>

        <div className="space-y-5 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="grid gap-3 sm:grid-cols-2">
            {sportOptions.map((sport) => {
              const active = form.primary_sports.includes(sport);
              return (
                <button
                  key={sport}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      primary_sports: active
                        ? current.primary_sports.filter((item) => item !== sport)
                        : [...current.primary_sports, sport],
                    }))
                  }
                  className={`rounded-[24px] border px-4 py-4 text-left transition ${
                    active ? 'border-ink bg-panel text-paper' : 'border-ink/10 bg-paper text-ink hover:bg-[#efe7dc]'
                  }`}
                >
                  <p className="text-base font-semibold">{sport}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <select
              value={form.years_racing_band}
              onChange={(event) => setForm((current) => ({ ...current, years_racing_band: event.target.value }))}
              className={fieldClassName()}
            >
              <option value="">Years racing at this distance</option>
              {yearsOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={form.weekly_training_hours_band}
              onChange={(event) => setForm((current) => ({ ...current, weekly_training_hours_band: event.target.value }))}
              className={fieldClassName()}
            >
              <option value="">Weekly training hours</option>
              {hoursOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Home elevation (ft)"
              value={form.home_elevation_ft}
              onChange={(event) => setForm((current) => ({ ...current, home_elevation_ft: event.target.value }))}
              className={fieldClassName()}
            />
          </div>
        </div>
      </section>,
      <section key="strava" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Training context</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">
            Connect Strava to add training context to every protocol you log
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/76">
            Threshold uses your Strava activity data to link interventions to specific workouts — so you can see whether your heat block happened on a hard week or an easy week.
          </p>
        </div>

        <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          {router.query.strava === 'connected' ? (
            <div className="rounded-[24px] bg-paper p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-accent">Connected</p>
              <p className="mt-3 text-xl font-semibold text-ink">{stravaName || 'Strava connected'}</p>
              <p className="mt-2 text-sm text-ink/68">Training context is ready. Finish setup to open your dashboard.</p>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            <a href="/api/strava/login" className="inline-flex w-full items-center justify-center rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper">
              Connect Strava
            </a>
            <p className="text-center text-xs text-ink/45">Strava is live today. Garmin and COROS are coming soon.</p>
            <button
              type="button"
              onClick={() => completeOnboarding()}
              className="w-full rounded-full border border-ink/10 bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-white"
            >
              Skip — I&apos;ll connect later
            </button>
            <p className="text-center text-xs text-ink/40">You can connect or manually log activities any time from Connections.</p>
          </div>
        </div>
      </section>,
    ],
    [catalogQuery, catalogResults, form, manualRace, router.query.strava, stravaName]
  );

  async function saveProgress(onboardingComplete = false) {
    setSaving(true);
    const payload = {
      onboarding_complete: onboardingComplete,
      primary_sports: form.primary_sports,
      years_racing_band: form.years_racing_band,
      weekly_training_hours_band: form.weekly_training_hours_band,
      home_elevation_ft: form.home_elevation_ft,
      target_race: form.target_race,
      target_race_id: form.target_race_id || null,
    };
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    return res.ok;
  }

  async function nextFromRace() {
    if (manualRace && form.target_race && (!form.target_race.name || !form.target_race.event_date || !form.target_race.distance_miles || !form.target_race.location)) {
      return;
    }
    await saveProgress(false);
    setStep(2);
  }

  async function nextFromSport() {
    if (!form.primary_sports.length || !form.years_racing_band || !form.weekly_training_hours_band) {
      return;
    }
    await saveProgress(false);
    setStep(3);
  }

  async function completeOnboarding() {
    const ok = await saveProgress(true);
    if (ok) {
      router.push('/dashboard?welcome=1');
    }
  }

  useEffect(() => {
    if (router.query.strava === 'connected' && !loading) {
      const timeoutId = setTimeout(() => {
        completeOnboarding();
      }, 1200);
      return () => clearTimeout(timeoutId);
    }
  }, [router.query.strava, loading]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-paper text-ink">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[42px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold onboarding</p>
            <StepIndicator step={step} />
          </div>

          <div className="mt-10 overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${(step - 1) * 100}%)` }}
            >
              {slides.map((slide, index) => (
                <div key={index} className="w-full shrink-0 pr-4">
                  {slide}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              className={`rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink ${step === 1 ? 'invisible' : ''}`}
            >
              Back
            </button>

            {step === 1 ? (
              <button type="button" onClick={nextFromRace} disabled={saving} className="rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper">
                Continue
              </button>
            ) : null}
            {step === 2 ? (
              <button type="button" onClick={nextFromSport} disabled={saving} className="rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper">
                Continue
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
