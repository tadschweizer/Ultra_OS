import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { safePostAuthPath, isCoachInvitationPath } from '../lib/auth/redirects.js';
import { clearMe } from '../lib/meClient';

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


const button = 'inline-flex min-h-12 items-center justify-center rounded-full bg-panel px-6 py-3 text-sm font-semibold text-paper disabled:opacity-50';
const field = 'w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-ink';

async function readJson(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load your setup. Please try again.');
  return data;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState('individual');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [connections, setConnections] = useState([]);
  const [connectionError, setConnectionError] = useState('');
  const [code, setCode] = useState('');
  const [availability, setAvailability] = useState(null);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [coachProfile, setCoachProfile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ primary_sports: [], weekly_training_hours_band: '', years_racing_band: '', home_elevation_ft: '', target_race_id: null });

  async function loadConnections() {
    setConnectionError('');
    try {
      const data = await readJson('/api/coach-connection');
      setConnections(data.connections || []);
    } catch {
      setConnectionError('We could not check your coach connection. Try again before entering a code.');
    }
  }

  async function load() {
    setLoading(true); setLoadError('');
    try {
      const data = await readJson('/api/onboarding');
      const nextRole = data.athlete?.primary_role === 'coach' ? 'coach' : data.signupRole === 'athlete-with-coach' ? 'athlete-with-coach' : 'individual';
      setRole(nextRole);
      setForm({
        primary_sports: data.athlete?.primary_sports || [],
        weekly_training_hours_band: data.athlete?.weekly_training_hours_band || '',
        years_racing_band: data.athlete?.years_racing_band || '',
        home_elevation_ft: data.athlete?.home_elevation_ft ?? '',
        target_race_id: data.targetRace?.id || data.athlete?.target_race_id || null,
      });
      if (nextRole === 'coach') {
        const profile = await readJson('/api/coach-profile', { method: 'POST' });
        if (!profile.profile?.coach_code) throw new Error('Could not load your coach code. Please try again.');
        setCoachProfile(profile.profile);
      } else {
        await loadConnections();
        await Promise.all([
          readJson('/api/integrations/status').then(setAvailability).catch(() => setAvailability(null)),
          readJson('/api/me').then(data => setStravaConnected(Boolean(data.athlete?.strava_id))).catch(() => {}),
        ]);
      }
    } catch (err) { setLoadError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!router.isReady) return;
    // Recover an invitation destination before asking for any profile details.
    const next = safePostAuthPath(router.query.next, '');
    if (isCoachInvitationPath(next)) { router.replace(next); return; }
    load();
  }, [router.isReady]);

  async function connectCoach(event) {
    event.preventDefault();
    if (busyRef.current) return;
    if (!code.trim()) { setError('Enter the code your coach shared with you.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const data = await readJson('/api/coach-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_code: code.trim().toUpperCase() }),
      });
      setConnections(current => [...current, data.connection]); setCode('');
    } catch (err) { setError(err.message); await loadConnections(); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function finish() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      await readJson('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role, onboarding_complete: true }),
      });
      clearMe();
      const next = safePostAuthPath(router.query.next, '');
      window.location.assign(next && !next.startsWith('/onboarding') ? next : role === 'coach' ? '/coach-command-center' : '/calendar');
    } catch {
      setError('We could not save your setup. Your answers are still here; please try again.');
      busyRef.current = false; setBusy(false);
    }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(coachProfile.coach_code); setCopied(true); }
    catch { setError('Copy was unavailable. Select the coach code above and copy it manually.'); }
  }

  const returnPath = safePostAuthPath(router.query.next, '/calendar');
  const isCoach = role === 'coach';
  return (
    <main className="min-h-screen bg-paper px-4 py-8 text-ink sm:py-12">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-xs font-semibold uppercase tracking-[0.25em] text-ink">Threshold</a>
        {loading ? <p role="status" className="py-16">Loading your setup…</p> : loadError ? (
          <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-6">
            <p role="alert">{loadError}</p><button className={`${button} mt-5`} onClick={load}>Try again</button>
          </div>
        ) : (
          <>
            {!isCoach && <nav aria-label="Setup progress" className="mt-8 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold">Step {step + 1} of 2</span>
              <span aria-current={step === 0 ? 'step' : undefined} className={step === 0 ? 'text-ink font-semibold' : 'text-ink/60'}>Connections</span>
              <span aria-current={step === 1 ? 'step' : undefined} className={step === 1 ? 'text-ink font-semibold' : 'text-ink/60'}>About you</span>
            </nav>}
            <h1 className="font-display mt-6 text-4xl leading-tight sm:text-5xl">{isCoach ? 'Welcome, coach.' : step === 0 ? 'Your training, connected.' : 'A little about your training.'}</h1>
            <p className="mt-4 max-w-xl leading-7 text-ink/70">{isCoach ? 'Invite your first athlete from your roster, then plan their training.' : step === 0 ? 'Check your coach connection and connect an activity account if you use one. You can also log training manually.' : 'Give your coach a starting point. These details are optional, and you can update them in Settings. Add races later from Races.'}</p>
            {isCoach ? (
              <section className="mt-8 rounded-2xl border border-ink/10 bg-white p-6">
                <h2 className="text-lg font-semibold">Your coach code</h2>
                <p className="my-4 break-all font-mono text-2xl">{coachProfile?.coach_code}</p>
                <button onClick={copyCode} className="min-h-12 rounded-full border border-ink/20 px-5">{copied ? 'Copied' : 'Copy code'}</button>
                <p className="mt-4 text-sm leading-6 text-ink/70">Athletes using this code send a request for your approval. A personal invitation link lets them accept your invitation directly.</p>
              </section>
            ) : step === 0 ? (
              <div className="mt-8 space-y-6">
                <section className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
                  <h2 className="text-xl font-semibold">Your coach</h2>
                  {connectionError ? <div className="mt-4"><p role="alert" className="text-sm text-red-700">{connectionError}</p><button onClick={loadConnections} className="mt-3 min-h-12 underline">Check again</button></div> : connections.length ? connections.map(connection => (
                    <div key={connection.id} className="mt-4 border-l-4 border-accent pl-4">
                      <p className="font-semibold">{connection.coach?.display_name || 'Your coach'}</p>
                      <p className="mt-1 text-sm text-ink/70">{connection.status === 'active' ? 'Connected — your coach can plan and review your training.' : 'Request sent — waiting for your coach to approve.'}</p>
                    </div>
                  )) : (
                    <details className="mt-4" open={role === 'athlete-with-coach'}>
                      <summary className="min-h-11 cursor-pointer text-sm font-semibold">Have a coach code?</summary>
                      <p className="mb-4 text-sm leading-6 text-ink/70">If your coach sent an invitation link, open that link to accept it. A coach code sends a request for approval.</p>
                      <form onSubmit={connectCoach} className="space-y-3">
                        <label htmlFor="coach-code" className="block text-sm font-semibold">Coach code</label>
                        <input id="coach-code" value={code} onChange={event => setCode(event.target.value)} className={field} autoCapitalize="characters" />
                        <button disabled={busy} className={button}>{busy ? 'Sending…' : 'Send connection request'}</button>
                      </form>
                    </details>
                  )}
                </section>
                <section className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
                  <h2 className="text-xl font-semibold">Activity accounts <span className="text-sm font-normal text-ink/60">Optional</span></h2>
                  <p className="mt-2 text-sm leading-6 text-ink/70">Connect a supported account to import activities. You can manage connections later.</p>
                  {availability === null && <p role="status" className="mt-3 text-sm">Availability could not be checked. You can connect later from Connections.</p>}
                  {['Strava', 'Garmin', 'COROS'].map(provider => (
                    <div key={provider} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 py-5 last:border-0">
                      <div><h3 className="font-semibold">{provider}</h3><p className="mt-1 text-sm text-ink/65">{provider === 'Strava' ? stravaConnected ? 'Connected' : availability?.strava ? 'Ready to connect' : 'Currently unavailable' : 'Not available yet'}</p></div>
                      {provider === 'Strava' && availability?.strava && !stravaConnected && <a className={button} href={`/api/strava/login?next=${encodeURIComponent(returnPath)}`}>Connect Strava</a>}
                    </div>
                  ))}
                </section>
              </div>
            ) : (
              <section className="mt-8 rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-semibold">What do you enjoy?</h2>
                <p className="mt-2 text-sm text-ink/65">Choose any that fit. No racing experience needed.</p>
                <div className="mt-5 space-y-5">{SPORT_GROUPS.map(group => <details key={group.label} open={group.label === 'Running' || group.sports.some(sport => form.primary_sports.includes(sport))}>
                  <summary className="mb-2 min-h-11 cursor-pointer text-sm font-semibold text-ink/70">{group.label}</summary>
                  <div className="flex flex-wrap gap-2">{group.sports.map(sport => {
                    const selected = form.primary_sports.includes(sport);
                    return <button key={sport} type="button" aria-pressed={selected} onClick={() => setForm(current => ({ ...current, primary_sports: selected ? current.primary_sports.filter(item => item !== sport) : [...current.primary_sports, sport] }))} className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${selected ? 'border-panel bg-panel text-paper' : 'border-ink/15 bg-paper text-ink'}`}>{sport}</button>;
                  })}</div>
                </details>)}</div>
                <label htmlFor="training-hours" className="mb-2 mt-6 block text-sm font-semibold">Usual training hours per week (optional)</label>
                <select id="training-hours" className={field} value={form.weekly_training_hours_band} onChange={event => setForm(current => ({ ...current, weekly_training_hours_band: event.target.value }))}>
                  <option value="">Not sure yet</option>{['<8', '8-12', '12-16', '16-20', '20+'].map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </section>
            )}
            {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              {!isCoach && step === 1 ? <button disabled={busy} onClick={() => { setStep(0); setError(''); window.scrollTo(0, 0); }} className="min-h-12 rounded-full border border-ink/20 px-6">Back</button> : <span className="text-sm text-ink/60">{isCoach ? 'Ready when you are.' : 'Connections can be added later.'}</span>}
              <button disabled={busy} className={button} onClick={isCoach || step === 1 ? finish : () => { setStep(1); setError(''); window.scrollTo(0, 0); }}>{busy ? 'Saving…' : isCoach ? 'Open your roster' : step === 0 ? 'Continue' : 'Open my training'}</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
