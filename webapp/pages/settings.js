import { useEffect, useState } from 'react';

const emptySettings = {
  baseline_sleep_altitude_ft: '',
  baseline_training_altitude_ft: '',
  resting_hr: '',
  max_hr: '',
  body_weight_lb: '',
  normal_long_run_carb_g_per_hr: '',
  sweat_rate_l_per_hr: '',
  sodium_target_mg_per_hr: '',
  typical_sleep_hours: '',
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

const orderedZones = [
  ['hr_zone_1_min', 'hr_zone_1_max'],
  ['hr_zone_2_min', 'hr_zone_2_max'],
  ['hr_zone_3_min', 'hr_zone_3_max'],
  ['hr_zone_4_min', 'hr_zone_4_max'],
  ['hr_zone_5_min', 'hr_zone_5_max'],
];

function toFormValues(settings) {
  if (!settings) return emptySettings;

  return {
    baseline_sleep_altitude_ft: settings.baseline_sleep_altitude_ft ?? '',
    baseline_training_altitude_ft: settings.baseline_training_altitude_ft ?? '',
    resting_hr: settings.resting_hr ?? '',
    max_hr: settings.max_hr ?? '',
    body_weight_lb: settings.body_weight_lb ?? '',
    normal_long_run_carb_g_per_hr: settings.normal_long_run_carb_g_per_hr ?? '',
    sweat_rate_l_per_hr: settings.sweat_rate_l_per_hr ?? '',
    sodium_target_mg_per_hr: settings.sodium_target_mg_per_hr ?? '',
    typical_sleep_hours: settings.typical_sleep_hours ?? '',
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

function cascadeZones(currentForm, fieldName, value) {
  const nextForm = { ...currentForm, [fieldName]: value };
  const zoneIndex = orderedZones.findIndex((zone) => zone.includes(fieldName));

  if (zoneIndex === -1 || !fieldName.endsWith('_max')) {
    return nextForm;
  }

  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    return nextForm;
  }

  for (let index = zoneIndex + 1; index < orderedZones.length; index += 1) {
    const [minKey, maxKey] = orderedZones[index];
    const previousMaxKey = orderedZones[index - 1][1];
    const previousMaxValue = parseInt(nextForm[previousMaxKey], 10);

    if (Number.isNaN(previousMaxValue)) break;

    nextForm[minKey] = String(previousMaxValue + 1);

    const currentMaxValue = parseInt(nextForm[maxKey], 10);
    if (!Number.isNaN(currentMaxValue) && currentMaxValue <= previousMaxValue) {
      nextForm[maxKey] = '';
      break;
    }
  }

  return nextForm;
}

function ZoneRow({ label, minName, maxName, form, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[80px_1fr_1fr] sm:items-center">
      <p className="text-sm font-semibold text-slate-100">{label}</p>
      <input
        type="number"
        name={minName}
        value={form[minName]}
        onChange={onChange}
        placeholder="Min"
        className="rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white"
      />
      <input
        type="number"
        name={maxName}
        value={form[maxName]}
        onChange={onChange}
        placeholder="Max"
        className="rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white"
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
    setForm((current) => cascadeZones(current, name, value));
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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Athlete Profile</p>
          <h1 className="font-display text-4xl text-white">Performance Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Store stable baselines once so later intervention analysis compares protocol outcomes
            against your actual environment, fueling, and physiology.
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/dashboard" className="rounded-full border border-slate-500 px-4 py-2 text-sm text-slate-100">
            Back to Dashboard
          </a>
          <a href="/log-intervention" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-panel">
            Log Intervention
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-[30px] border border-white/10 bg-card p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
          {message ? (
            <p className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
              {message}
            </p>
          ) : null}

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-white">Altitude Baselines</p>
              <p className="text-sm text-slate-400">
                These anchor altitude tent, camp, and high-elevation workout interpretation.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Baseline Sleep Altitude (ft)</label>
                <input type="number" name="baseline_sleep_altitude_ft" value={form.baseline_sleep_altitude_ft} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Typical Training Altitude (ft)</label>
                <input type="number" name="baseline_training_altitude_ft" value={form.baseline_training_altitude_ft} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-white">Physiology Anchors</p>
              <p className="text-sm text-slate-400">
                These are stable enough to make downstream analysis more useful before wearables are connected.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Resting HR</label>
                <input type="number" name="resting_hr" value={form.resting_hr} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Max HR</label>
                <input type="number" name="max_hr" value={form.max_hr} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Body Weight (lb)</label>
                <input type="number" name="body_weight_lb" value={form.body_weight_lb} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-white">Fueling + Hydration Baselines</p>
              <p className="text-sm text-slate-400">
                These are practical reference points for gut training, sodium, and race-day intervention review.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Normal Long-Run Carbs (g/hr)</label>
                <input type="number" name="normal_long_run_carb_g_per_hr" value={form.normal_long_run_carb_g_per_hr} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Sodium Target (mg/hr)</label>
                <input type="number" name="sodium_target_mg_per_hr" value={form.sodium_target_mg_per_hr} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Sweat Rate (L/hr)</label>
                <input type="number" step="0.1" name="sweat_rate_l_per_hr" value={form.sweat_rate_l_per_hr} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-100">Typical Sleep (hours)</label>
                <input type="number" step="0.1" name="typical_sleep_hours" value={form.typical_sleep_hours} onChange={handleChange} className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-white">Heart Rate Zones</p>
              <p className="text-sm text-slate-400">
                If you enter a zone max, the next zone min auto-fills as one beat higher. Example: Zone 2 max 150 sets Zone 3 min to 151.
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
              className="w-full rounded-2xl border border-slate-500 bg-panel px-4 py-3 text-white"
              placeholder="Stable context that matters later: heat tolerance, common GI triggers, regular sleep location shifts, etc."
            />
          </section>

          <button type="submit" className="rounded-full bg-accent px-5 py-3 font-semibold text-panel">
            Save Settings
          </button>
        </form>

        <aside className="space-y-5">
          <div className="rounded-[30px] border border-white/10 bg-card/80 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Helpful Baselines</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>Sleep altitude and training altitude make altitude tent work interpretable.</li>
              <li>Body weight matters for protocols dosed per kilogram and hydration analysis.</li>
              <li>Carb, sweat, and sodium baselines make fueling interventions comparable across sessions.</li>
              <li>Typical sleep hours make sleep interventions more meaningful than a free-text note alone.</li>
            </ul>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-panel/80 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Source Model</p>
            <p className="mt-4 text-sm text-slate-300">
              Resting HR can stay manual now. Later, Garmin or another wearable can become the preferred source and update this baseline automatically.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
