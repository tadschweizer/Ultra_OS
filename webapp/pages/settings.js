import { useEffect, useState } from 'react';

const emptySettings = {
  baseline_sleep_altitude_ft: '',
  baseline_training_altitude_ft: '',
  resting_hr: '',
  max_hr: '',
  hr_zone_1_min: '',
  hr_zone_1_max: '',
  hr_zone_2_min: '',
  hr_zone_2_max: '',
  hr_zone_3_min: '',
  hr_zone_3_max: '',
  hr_zone_4_min: '',
  hr_zone_4_max: '',
  hr_zone_5_min: '',
  hr_zone_5_max: '',
  notes: '',
};

function toFormValues(settings) {
  if (!settings) return emptySettings;

  return {
    baseline_sleep_altitude_ft: settings.baseline_sleep_altitude_ft ?? '',
    baseline_training_altitude_ft: settings.baseline_training_altitude_ft ?? '',
    resting_hr: settings.resting_hr ?? '',
    max_hr: settings.max_hr ?? '',
    hr_zone_1_min: settings.hr_zone_1_min ?? '',
    hr_zone_1_max: settings.hr_zone_1_max ?? '',
    hr_zone_2_min: settings.hr_zone_2_min ?? '',
    hr_zone_2_max: settings.hr_zone_2_max ?? '',
    hr_zone_3_min: settings.hr_zone_3_min ?? '',
    hr_zone_3_max: settings.hr_zone_3_max ?? '',
    hr_zone_4_min: settings.hr_zone_4_min ?? '',
    hr_zone_4_max: settings.hr_zone_4_max ?? '',
    hr_zone_5_min: settings.hr_zone_5_min ?? '',
    hr_zone_5_max: settings.hr_zone_5_max ?? '',
    notes: settings.notes ?? '',
  };
}

function ZoneRow({ label, minName, maxName, form, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[80px_1fr_1fr] sm:items-center">
      <p className="text-sm font-semibold text-slate-200">{label}</p>
      <input
        type="number"
        name={minName}
        value={form[minName]}
        onChange={onChange}
        placeholder="Min"
        className="rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
      />
      <input
        type="number"
        name={maxName}
        value={form[maxName]}
        onChange={onChange}
        placeholder="Max"
        className="rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
      />
    </div>
  );
}

export default function Settings() {
  const [form, setForm] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setForm(toFormValues(data.settings));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return;
    }

    setForm(toFormValues(data.settings));
    setMessage('Settings saved.');
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Athlete Profile</p>
          <h1 className="text-3xl font-bold text-white">Performance Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Store stable personal context once so later intervention analysis can compare protocol
            outcomes against your actual baseline instead of guessing.
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/dashboard" className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200">
            Back to Dashboard
          </a>
          <a href="/log-intervention" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-primary">
            Log Intervention
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-[28px] border border-slate-700 bg-secondary/60 p-6 shadow-2xl shadow-black/30">
          {message ? (
            <p className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
              {message}
            </p>
          ) : null}

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-white">Altitude Baselines</p>
              <p className="text-sm text-slate-400">
                These are the anchor points for future acclimation logic. Use where you normally
                sleep and where you usually train.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Baseline Sleep Altitude (ft)</label>
                <input
                  type="number"
                  name="baseline_sleep_altitude_ft"
                  value={form.baseline_sleep_altitude_ft}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Typical Training Altitude (ft)</label>
                <input
                  type="number"
                  name="baseline_training_altitude_ft"
                  value={form.baseline_training_altitude_ft}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-white">Heart Rate Anchors</p>
              <p className="text-sm text-slate-400">
                Keep these stable so later performance interpretation has useful context.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Resting HR</label>
                <input
                  type="number"
                  name="resting_hr"
                  value={form.resting_hr}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Max HR</label>
                <input
                  type="number"
                  name="max_hr"
                  value={form.max_hr}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-white">Heart Rate Zones</p>
              <p className="text-sm text-slate-400">
                Enter the lower and upper bounds you actually use. These can later support protocol
                interpretation around effort, fatigue, and adaptation.
              </p>
            </div>
            <div className="space-y-3">
              <ZoneRow label="Zone 1" minName="hr_zone_1_min" maxName="hr_zone_1_max" form={form} onChange={handleChange} />
              <ZoneRow label="Zone 2" minName="hr_zone_2_min" maxName="hr_zone_2_max" form={form} onChange={handleChange} />
              <ZoneRow label="Zone 3" minName="hr_zone_3_min" maxName="hr_zone_3_max" form={form} onChange={handleChange} />
              <ZoneRow label="Zone 4" minName="hr_zone_4_min" maxName="hr_zone_4_max" form={form} onChange={handleChange} />
              <ZoneRow label="Zone 5" minName="hr_zone_5_min" maxName="hr_zone_5_max" form={form} onChange={handleChange} />
            </div>
          </section>

          <section>
            <label className="mb-1 block text-sm font-semibold text-slate-100">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={5}
              className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              placeholder="Anything stable that matters later: heat tolerance, normal sleep location shifts, known GI notes, etc."
            />
          </section>

          <button type="submit" className="rounded-full bg-accent px-5 py-3 font-semibold text-primary">
            Save Settings
          </button>
        </form>

        <aside className="space-y-5">
          <div className="rounded-[28px] border border-slate-700 bg-slate-950/80 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Why This Matters</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>Altitude interventions only make sense relative to where you normally live and train.</li>
              <li>Heart-rate-based interpretation is weak if the platform has no zone context.</li>
              <li>Stable athlete settings reduce future AI guesswork and improve trust.</li>
            </ul>
          </div>

          <div className="rounded-[28px] border border-slate-700 bg-secondary/40 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Strava Altitude Reality</p>
            <p className="mt-4 text-sm text-slate-300">
              We can pull elevation high/low and altitude stream data from Strava with a deeper activity
              request. That supports start altitude, end altitude, peak elevation, and rough acclimation
              context, but it still does not tell us where you sleep unless you store that here.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
