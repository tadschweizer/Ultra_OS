import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import NavMenu from '../components/NavMenu';

const FINISH_OUTCOMES = [
  'Finished — better than goal',
  'Finished — on goal',
  'Finished — slower than goal',
  'Finished — time not my focus',
  'DNF — physical issue',
  'DNF — GI issue',
  'DNF — mental / motivation',
  'DNS — did not start',
];

const GI_LABELS = ['None', 'Minor', 'Moderate', 'Significant', 'Race-ending'];
const ENERGY_LABELS = ['Crashed hard', 'Faded', 'Consistent', 'Strong finish', 'Negative split'];
const PACING_LABELS = ['Went out too fast', 'Even split', 'Negative split', 'Too conservative early'];

const emptyForm = {
  raceName: '',
  raceDate: '',
  raceType: '',
  finishOutcome: '',
  finishTimeH: '',
  finishTimeM: '',
  goalTimeH: '',
  goalTimeM: '',
  overallRating: '',
  giDistressScore: '0',
  energyManagement: '',
  pacingStrategy: '',
  peakHrBpm: '',
  avgHrBpm: '',
  avgCarbsGPerHr: '',
  totalFluidL: '',
  heatImpact: '',
  whatWorked: '',
  whatToChange: '',
  wouldUseAgain: '',
  notes: '',
};

function ScaleButton({ value, selected, onClick, label }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition
        ${selected
          ? 'bg-ink text-paper shadow-[0_4px_12px_rgba(19,24,22,0.22)]'
          : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
        }`}
      title={label}
    >
      {value}
    </button>
  );
}

function SectionTitle({ children }) {
  return <p className="mb-4 text-xs uppercase tracking-[0.28em] text-accent">{children}</p>;
}

function FieldLabel({ children, sub }) {
  return (
    <label className="mb-1.5 block text-sm font-semibold text-ink">
      {children}
      {sub ? <span className="ml-1 font-normal text-ink/45">{sub}</span> : null}
    </label>
  );
}

const inputCls = 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30';
const selectCls = 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30';
const textareaCls = 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none';

export default function RaceOutcomePage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const navLinks = [
    { href: '/dashboard', label: 'Home' },
    { href: '/race-plan', label: 'Race Blueprint' },
    { href: '/history', label: 'Intervention History' },
    { href: '/insights', label: 'Insights' },
  ];

  // Pre-fill from recent race in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ultraos-recent-race-outcome');
      if (stored) return; // already captured

      const saved = localStorage.getItem('ultraos-default-race');
      if (saved) {
        const race = JSON.parse(saved);
        const profile = race.race_profile || {};
        setForm((prev) => ({
          ...prev,
          raceName: race.target_race || profile.name || '',
          raceDate: race.target_race_date || profile.event_date || '',
          raceType: race.race_type || profile.race_type || '',
        }));
      }
    } catch (_) {}
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.raceName.trim()) {
      setError('Please enter a race name.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const payload = {
        race_name: form.raceName.trim(),
        race_date: form.raceDate || null,
        race_type: form.raceType || null,
        finish_outcome: form.finishOutcome || null,
        finish_time_minutes: form.finishTimeH || form.finishTimeM
          ? (parseInt(form.finishTimeH || 0) * 60) + parseInt(form.finishTimeM || 0)
          : null,
        goal_time_minutes: form.goalTimeH || form.goalTimeM
          ? (parseInt(form.goalTimeH || 0) * 60) + parseInt(form.goalTimeM || 0)
          : null,
        overall_rating: form.overallRating ? parseInt(form.overallRating) : null,
        gi_distress_score: parseInt(form.giDistressScore) || 0,
        energy_management: form.energyManagement || null,
        pacing_strategy: form.pacingStrategy || null,
        peak_hr_bpm: form.peakHrBpm ? parseInt(form.peakHrBpm) : null,
        avg_hr_bpm: form.avgHrBpm ? parseInt(form.avgHrBpm) : null,
        avg_carbs_g_per_hr: form.avgCarbsGPerHr ? parseFloat(form.avgCarbsGPerHr) : null,
        total_fluid_l: form.totalFluidL ? parseFloat(form.totalFluidL) : null,
        heat_impact: form.heatImpact || null,
        what_worked: form.whatWorked.trim() || null,
        what_to_change: form.whatToChange.trim() || null,
        would_use_again: form.wouldUseAgain || null,
        notes: form.notes.trim() || null,
      };

      const res = await fetch('/api/race-outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }

      // Mark as captured so banner stops prompting
      localStorage.setItem('ultraos-recent-race-outcome', JSON.stringify({ raceName: form.raceName, savedAt: new Date().toISOString() }));

      setSaved(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto max-w-xl">
          <div className="mt-20 rounded-[36px] border border-ink/10 bg-white p-10 text-center shadow-[0_24px_60px_rgba(19,24,22,0.07)]">
            <p className="text-4xl">🏅</p>
            <h1 className="font-display mt-6 text-3xl font-semibold">Race logged.</h1>
            <p className="mt-3 text-sm leading-7 text-ink/60">
              Your outcome is saved. As you log more races and interventions, Threshold will surface patterns in what worked and what cost you time.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/insights"
                className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-[0_4px_14px_rgba(19,24,22,0.18)]"
              >
                View Insights →
              </a>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-ink/10 px-6 py-3 text-sm font-semibold text-ink"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Race Outcome</p>
          <NavMenu
            label="Race outcome navigation"
            links={navLinks}
            primaryLink={{ href: '/race-plan', label: 'Race Blueprint', variant: 'secondary' }}
          />
        </div>

        {/* Hero */}
        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(145deg,#eee7dc_0%,#c5b8a8_60%,#7a6553_100%)] p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-accent">Post-Race Log</p>
          <h1 className="font-display mt-3 text-4xl leading-tight md:text-5xl">How did it go?</h1>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            Your race data is the most valuable thing you can log. Every outcome you capture becomes input for your next race blueprint.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">

          {/* Race identity */}
          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race Details</SectionTitle>
            <div className="space-y-4">
              <div>
                <FieldLabel>Race name</FieldLabel>
                <input type="text" name="raceName" value={form.raceName} onChange={handleChange} placeholder="e.g. Boston Marathon 2026" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Race date</FieldLabel>
                  <input type="date" name="raceDate" value={form.raceDate} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <FieldLabel>Race type</FieldLabel>
                  <select name="raceType" value={form.raceType} onChange={handleChange} className={selectCls}>
                    <option value="">Select type</option>
                    {['1 Mile / 1500m', '3K / 5K', '10K', 'Half Marathon', 'Marathon', '50K+', 'Gravel', 'Triathlon', 'Other'].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Outcome */}
          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race Outcome</SectionTitle>
            <div className="space-y-4">
              <div>
                <FieldLabel>How did it go?</FieldLabel>
                <select name="finishOutcome" value={form.finishOutcome} onChange={handleChange} className={selectCls}>
                  <option value="">Select outcome</option>
                  {FINISH_OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Finish time</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input type="number" name="finishTimeH" value={form.finishTimeH} onChange={handleChange} placeholder="hrs" min="0" className={inputCls} />
                    <span className="shrink-0 text-sm text-ink/40">h</span>
                    <input type="number" name="finishTimeM" value={form.finishTimeM} onChange={handleChange} placeholder="min" min="0" max="59" className={inputCls} />
                    <span className="shrink-0 text-sm text-ink/40">m</span>
                  </div>
                </div>
                <div>
                  <FieldLabel>Goal time</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input type="number" name="goalTimeH" value={form.goalTimeH} onChange={handleChange} placeholder="hrs" min="0" className={inputCls} />
                    <span className="shrink-0 text-sm text-ink/40">h</span>
                    <input type="number" name="goalTimeM" value={form.goalTimeM} onChange={handleChange} placeholder="min" min="0" max="59" className={inputCls} />
                    <span className="shrink-0 text-sm text-ink/40">m</span>
                  </div>
                </div>
              </div>

              {/* Overall rating */}
              <div>
                <FieldLabel>Overall race rating</FieldLabel>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <ScaleButton
                      key={n}
                      value={String(n)}
                      selected={form.overallRating === String(n)}
                      onClick={(v) => setField('overallRating', v)}
                      label={n <= 3 ? 'Poor' : n <= 6 ? 'Okay' : n <= 8 ? 'Good' : 'Outstanding'}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink/40">1 = disaster · 10 = best race of your life</p>
              </div>
            </div>
          </div>

          {/* Execution */}
          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race Execution</SectionTitle>
            <div className="space-y-4">

              <div>
                <FieldLabel>GI distress</FieldLabel>
                <div className="flex gap-2 flex-wrap">
                  {GI_LABELS.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('giDistressScore', String(i))}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${form.giDistressScore === String(i)
                          ? 'bg-ink text-paper'
                          : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Energy management</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {ENERGY_LABELS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('energyManagement', label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${form.energyManagement === label
                          ? 'bg-ink text-paper'
                          : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Pacing strategy</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {PACING_LABELS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('pacingStrategy', label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${form.pacingStrategy === label
                          ? 'bg-ink text-paper'
                          : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Did heat significantly impact performance?</FieldLabel>
                <div className="flex gap-2">
                  {['Yes — big factor', 'Somewhat', 'No — non-issue'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('heatImpact', label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${form.heatImpact === label
                          ? 'bg-ink text-paper'
                          : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Data */}
          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race-Day Data</SectionTitle>
            <p className="mb-4 text-xs leading-5 text-ink/45">Optional — pull from your Garmin or Strava file if available.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Avg HR</FieldLabel>
                <input type="number" name="avgHrBpm" value={form.avgHrBpm} onChange={handleChange} placeholder="bpm" className={inputCls} />
              </div>
              <div>
                <FieldLabel>Peak HR</FieldLabel>
                <input type="number" name="peakHrBpm" value={form.peakHrBpm} onChange={handleChange} placeholder="bpm" className={inputCls} />
              </div>
              <div>
                <FieldLabel>Avg carbs</FieldLabel>
                <input type="number" name="avgCarbsGPerHr" value={form.avgCarbsGPerHr} onChange={handleChange} placeholder="g/hr" step="0.1" className={inputCls} />
              </div>
              <div>
                <FieldLabel>Total fluid</FieldLabel>
                <input type="number" name="totalFluidL" value={form.totalFluidL} onChange={handleChange} placeholder="litres" step="0.1" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Reflection */}
          <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_8px_24px_rgba(19,24,22,0.05)]">
            <SectionTitle>Race Debrief</SectionTitle>
            <div className="space-y-4">

              <div>
                <FieldLabel>What worked well?</FieldLabel>
                <textarea
                  name="whatWorked"
                  value={form.whatWorked}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Nutrition execution, pacing strategy, heat prep, bicarb timing…"
                  className={textareaCls}
                />
              </div>

              <div>
                <FieldLabel>What would you change?</FieldLabel>
                <textarea
                  name="whatToChange"
                  value={form.whatToChange}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Start slower, more gut training, different bicarb delivery…"
                  className={textareaCls}
                />
              </div>

              <div>
                <FieldLabel>Would you use this prep stack again?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {['Yes — no changes', 'Yes — with adjustments', 'Unsure', 'No'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('wouldUseAgain', label)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition
                        ${form.wouldUseAgain === label
                          ? 'bg-ink text-paper'
                          : 'border border-ink/10 bg-paper text-ink/60 hover:bg-white hover:text-ink'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Additional notes</FieldLabel>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Anything else worth capturing…"
                  className={textareaCls}
                />
              </div>

            </div>
          </div>

          {/* Submit */}
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-ink py-4 text-sm font-semibold text-paper shadow-[0_4px_16px_rgba(19,24,22,0.2)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Race Outcome →'}
          </button>

          <p className="pb-8 text-center text-xs text-ink/35">
            Your race outcomes are private and used only to generate personalized insights.
          </p>

        </form>
      </div>
    </main>
  );
}
