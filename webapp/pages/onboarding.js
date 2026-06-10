import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import RaceSearchInput from '../components/RaceSearchInput';

export const SPORT_GROUPS = [
  {
    label: 'Running',
    sports: ['Ultrarunner', 'Trail Runner', 'Marathoner', 'Half Marathoner', 'Road Racer (5K-10K)'],
  },
  {
    label: 'Cycling',
    sports: ['Gravel Cyclist', 'Road Cyclist', 'Mountain Biker'],
  },
  {
    label: 'Multi-Sport',
    sports: ['Long-Course Triathlete', 'Short-Course Triathlete'],
  },
  {
    label: 'Aquatic',
    sports: ['Open-Water Swimmer', 'Pool Swimmer', 'Rower', 'Paddler (Kayak / Canoe)'],
  },
  {
    label: 'Winter / Ice',
    sports: ['Speed Skater', 'Cross-Country Skier', 'Biathlete'],
  },
  {
    label: 'Team Sports',
    sports: ['Soccer Player', 'Lacrosse Player'],
  },
];

const yearsOptions = ['1', '2-3', '4-6', '7+'];
const hoursOptions = ['<8', '8-12', '12-16', '16-20', '20+'];

const SIGNUP_ROLE_STORAGE_KEY = 'threshold_signup_role';

const ROLE_OPTIONS = [
  {
    id: 'coach',
    title: "I'm a coach",
    body: 'Set up your roster, get your coach code, and run your athletes from the Command Center.',
  },
  {
    id: 'athlete-with-coach',
    title: "I'm an athlete joining a coach",
    body: 'Connect with your coach code so everything you log reaches your coach.',
  },
  {
    id: 'individual',
    title: "I'm an individual athlete",
    body: 'Self-coached. Threshold correlates your own data and coaches you directly.',
  },
];

const STEP_LABELS = {
  path: 'Your Path',
  'coach-setup': 'Coach Setup',
  'coach-code': 'Your Coach',
  race: 'Your Race',
  sport: 'Your Sport',
  strava: 'Connect Data',
};

function stepsForRole(role) {
  if (role === 'coach') return ['path', 'coach-setup'];
  if (role === 'athlete-with-coach') return ['path', 'coach-code', 'race', 'sport', 'strava'];
  return ['path', 'race', 'sport', 'strava'];
}

function fieldClassName() {
  return 'w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-ink';
}

function StepIndicator({ steps, stepIndex }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-full bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-paper">
        Step {stepIndex + 1} of {steps.length}
      </span>
      {steps.map((key, index) => (
        <span
          key={key}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
            index === stepIndex ? 'bg-white text-ink' : 'bg-white/50 text-ink/52'
          }`}
        >
          {STEP_LABELS[key]}
        </span>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState('individual');
  const [roleInitialized, setRoleInitialized] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [raceSearchQuery, setRaceSearchQuery] = useState('');
  const [manualRace, setManualRace] = useState(false);
  const [stravaName, setStravaName] = useState('');
  const [coachProfile, setCoachProfile] = useState(null);
  const [coachCodeCopied, setCoachCodeCopied] = useState(false);
  const [coachCodeInput, setCoachCodeInput] = useState('');
  const [coachConnection, setCoachConnection] = useState(null);
  const [coachCodeError, setCoachCodeError] = useState('');
  const [connectingCoach, setConnectingCoach] = useState(false);
  const [form, setForm] = useState({
    target_race_id: '',
    target_race: null,
    primary_sports: [],
    years_racing_band: '',
    weekly_training_hours_band: '',
    home_elevation_ft: '',
  });

  const steps = useMemo(() => stepsForRole(role), [role]);
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];

  useEffect(() => {
    if (!router.isReady || roleInitialized) return;
    let initialRole = typeof router.query.role === 'string' ? router.query.role : '';
    if (!ROLE_OPTIONS.some((option) => option.id === initialRole)) {
      try {
        initialRole = window.localStorage.getItem(SIGNUP_ROLE_STORAGE_KEY) || '';
      } catch {
        initialRole = '';
      }
    }
    if (ROLE_OPTIONS.some((option) => option.id === initialRole)) {
      setRole(initialRole);
      // The path was already chosen at signup — drop straight into setup.
      setStepIndex(1);
    }
    setRoleInitialized(true);
  }, [router.isReady, router.query.role, roleInitialized]);

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
    if (role !== 'coach' || coachProfile) return;
    let cancelled = false;
    fetch('/api/coach-profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.profile) setCoachProfile(data.profile);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role, coachProfile]);

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

  function pickRole(nextRole) {
    setRole(nextRole);
    try {
      window.localStorage.setItem(SIGNUP_ROLE_STORAGE_KEY, nextRole);
    } catch {
      // Storage is best-effort; the choice still lives in component state.
    }
  }

  async function connectCoach() {
    const code = coachCodeInput.trim().toUpperCase();
    if (!code) {
      setCoachCodeError('Enter the coach code your coach shared with you.');
      return;
    }
    setConnectingCoach(true);
    setCoachCodeError('');
    try {
      const res = await fetch('/api/coach-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_code: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoachCodeError(data.error || 'Could not connect to that coach code.');
        return;
      }
      setCoachConnection(data.connection);
    } catch {
      setCoachCodeError('Something went wrong. Please try again.');
    } finally {
      setConnectingCoach(false);
    }
  }

  async function copyCoachCode() {
    if (!coachProfile?.coach_code) return;
    try {
      await navigator.clipboard.writeText(coachProfile.coach_code);
      setCoachCodeCopied(true);
      setTimeout(() => setCoachCodeCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the code is visible on screen regardless.
    }
  }

  const slideMap = {
    path: (
      <section key="path" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Welcome to Threshold</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">How will you use Threshold?</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/76">
            Coaches run their roster from the Command Center. Athletes log the data that makes coaching smarter — with or without a coach attached.
          </p>
        </div>

        <div className="space-y-3 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          {ROLE_OPTIONS.map((option) => {
            const active = role === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => pickRole(option.id)}
                className={`w-full rounded-[24px] border px-5 py-4 text-left transition ${
                  active ? 'border-ink bg-panel text-paper' : 'border-ink/10 bg-paper text-ink hover:bg-[#efe7dc]'
                }`}
              >
                <p className="text-base font-semibold">{option.title}</p>
                <p className={`mt-1 text-sm ${active ? 'text-paper/75' : 'text-ink/60'}`}>{option.body}</p>
              </button>
            );
          })}
        </div>
      </section>
    ),
    'coach-setup': (
      <section key="coach-setup" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Coach setup</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Your roster starts with one code.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/76">
            Share your coach code with athletes. When they sign up and enter it, they land on your roster — and everything they log starts feeding your Command Center.
          </p>
        </div>

        <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Your coach code</p>
          {coachProfile ? (
            <div className="mt-3 flex items-center gap-3">
              <p className="rounded-[18px] bg-paper px-5 py-3 font-mono text-2xl font-semibold tracking-[0.2em] text-ink">
                {coachProfile.coach_code}
              </p>
              <button
                type="button"
                onClick={copyCoachCode}
                className="rounded-full border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper"
              >
                {coachCodeCopied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/60">Generating your coach code…</p>
          )}

          <div className="mt-5 space-y-2.5">
            {[
              'Send the code to your athletes — they enter it during signup.',
              'Assign protocols to athletes or whole groups from the Command Center.',
              'Triage who needs attention, who races soon, and who is off-protocol.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-ink/70">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => completeOnboarding()}
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper disabled:opacity-50"
            >
              Open your Command Center →
            </button>
            <a href="/pricing" className="block text-center text-sm font-semibold text-accent hover:underline">
              See Coach plan pricing
            </a>
          </div>
        </div>
      </section>
    ),
    'coach-code': (
      <section key="coach-code" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Your coach</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Connect to your coach.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/76">
            Enter the coach code your coach shared with you. Once connected, your logs, check-ins, and race prep show up on their dashboard automatically.
          </p>
        </div>

        <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          {coachConnection ? (
            <div className="rounded-[24px] bg-paper p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-accent">Connected</p>
              <p className="mt-3 text-xl font-semibold text-ink">
                {coachConnection.coach?.display_name || 'Your coach'}
              </p>
              <p className="mt-2 text-sm text-ink/68">
                You&apos;re on the roster. Continue to set up your race and training profile.
              </p>
            </div>
          ) : (
            <>
              <label className="mb-2 block text-sm font-semibold text-ink">Coach code</label>
              <input
                type="text"
                value={coachCodeInput}
                onChange={(event) => setCoachCodeInput(event.target.value)}
                placeholder="e.g. COACH-A1B2"
                className={`${fieldClassName()} font-mono uppercase tracking-[0.12em]`}
              />
              {coachCodeError ? (
                <p className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {coachCodeError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={connectCoach}
                disabled={connectingCoach}
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper disabled:opacity-50"
              >
                {connectingCoach ? 'Connecting…' : 'Connect to coach'}
              </button>
              <button
                type="button"
                onClick={() => setStepIndex((current) => current + 1)}
                className="mt-3 w-full rounded-full border border-ink/10 bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-white"
              >
                I&apos;ll connect later
              </button>
              <p className="mt-3 text-center text-xs text-ink/40">
                No code yet? Ask your coach, or connect any time from Settings.
              </p>
            </>
          )}
        </div>
      </section>
    ),
    race: (
      <section key="race" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Your next target</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Set your target race.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/76">
            Search the catalog first. If your event is not there, add it manually and keep moving.
          </p>
        </div>

        <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <label className="mb-2 block text-sm font-semibold text-ink">Search races</label>
          <RaceSearchInput
            value={raceSearchQuery}
            onChange={(v) => {
              setManualRace(false);
              setRaceSearchQuery(v);
            }}
            onSelect={(race) => {
              setRaceSearchQuery(race.name || '');
              setForm((current) => ({
                ...current,
                target_race_id: race.catalog_id || '',
                target_race: {
                  name: race.name,
                  event_date: race.event_date || '',
                  distance_miles: race.distance_miles || '',
                  location: race.location || '',
                  race_type: race.race_type || '',
                },
              }));
              if (race.source === 'web') {
                setManualRace(true);
              }
            }}
            placeholder="Western States 100"
          />

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setManualRace((current) => !current);
              }}
              className="text-sm font-semibold text-accent"
            >
              {manualRace ? 'Hide manual race entry' : 'Race not listed? Enter it manually'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm((current) => ({ ...current, target_race_id: '', target_race: null }));
                setStepIndex((current) => current + 1);
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
      </section>
    ),
    sport: (
      <section key="sport" className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Your background</p>
          <h1 className="font-display mt-4 text-5xl leading-tight md:text-7xl">Tell Threshold how you train.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/76">
            This gives the dashboard and future insights the context they need from day one.
          </p>
        </div>

        <div className="space-y-5 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="space-y-5">
            {SPORT_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">{group.label}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.sports.map((sport) => {
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
                        className={`rounded-[24px] border px-4 py-3 text-left transition ${
                          active ? 'border-ink bg-panel text-paper' : 'border-ink/10 bg-paper text-ink hover:bg-[#efe7dc]'
                        }`}
                      >
                        <p className="text-sm font-semibold">{sport}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
      </section>
    ),
    strava: (
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
      </section>
    ),
  };

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
    setStepIndex((current) => current + 1);
  }

  async function nextFromSport() {
    if (!form.primary_sports.length || !form.years_racing_band || !form.weekly_training_hours_band) {
      return;
    }
    await saveProgress(false);
    setStepIndex((current) => current + 1);
  }

  async function completeOnboarding() {
    const ok = await saveProgress(true);
    if (ok) {
      router.push(role === 'coach' ? '/coach-command-center' : '/dashboard?welcome=1');
    }
  }

  useEffect(() => {
    if (router.query.strava === 'connected' && !loading && roleInitialized) {
      const timeoutId = setTimeout(() => {
        completeOnboarding();
      }, 1200);
      return () => clearTimeout(timeoutId);
    }
  }, [router.query.strava, loading, roleInitialized]);

  if (loading || !roleInitialized) {
    return <div className="flex min-h-screen items-center justify-center bg-paper text-ink">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[42px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold onboarding</p>
            <StepIndicator steps={steps} stepIndex={stepIndex} />
          </div>

          <div className="mt-10 overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${stepIndex * 100}%)` }}
            >
              {steps.map((key) => (
                <div key={key} className="w-full shrink-0 pr-4">
                  {slideMap[key]}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              className={`rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink ${stepIndex === 0 ? 'invisible' : ''}`}
            >
              Back
            </button>

            {currentStep === 'path' ? (
              <button
                type="button"
                onClick={() => setStepIndex(1)}
                className="rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper"
              >
                Continue
              </button>
            ) : null}
            {currentStep === 'coach-code' && coachConnection ? (
              <button
                type="button"
                onClick={() => setStepIndex((current) => current + 1)}
                className="rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper"
              >
                Continue
              </button>
            ) : null}
            {currentStep === 'race' ? (
              <button type="button" onClick={nextFromRace} disabled={saving} className="rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper">
                Continue
              </button>
            ) : null}
            {currentStep === 'sport' ? (
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
