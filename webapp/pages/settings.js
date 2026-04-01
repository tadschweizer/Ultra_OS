import { useEffect, useRef, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';

const emptySettings = {
  baseline_sleep_altitude_ft: '',
  baseline_training_altitude_ft: '',
  resting_hr: '',
  max_hr: '',
  body_weight_lb: '',
  normal_long_run_carb_g_per_hr: '',
  sweat_rate_l_per_hr: '',
  sweat_sodium_concentration_mg_l: '',
  sodium_target_mg_per_hr: '',
  fluid_target_ml_per_hr: '',
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
  supplements: [{ supplement_name: '', amount: '', unit: 'mg', frequency_per_day: '1' }],
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
    sweat_sodium_concentration_mg_l: settings.sweat_sodium_concentration_mg_l ?? '',
    sodium_target_mg_per_hr: settings.sodium_target_mg_per_hr ?? '',
    fluid_target_ml_per_hr: settings.fluid_target_ml_per_hr ?? '',
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
    supplements:
      settings.supplements && settings.supplements.length > 0
        ? settings.supplements.map((item) => ({
            supplement_name: item.supplement_name ?? '',
            amount: item.amount ?? '',
            unit: item.unit ?? 'mg',
            frequency_per_day: item.frequency_per_day ?? '1',
          }))
        : [{ supplement_name: '', amount: '', unit: 'mg', frequency_per_day: '1' }],
  };
}

function cascadeZones(currentForm, fieldName, value) {
  const nextForm = { ...currentForm, [fieldName]: value };
  const zoneIndex = orderedZones.findIndex((zone) => zone.includes(fieldName));

  if (zoneIndex === -1) {
    return nextForm;
  }

  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    return nextForm;
  }

  if (fieldName.endsWith('_max')) {
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
  }

  if (fieldName.endsWith('_min') && zoneIndex > 0) {
    const previousMaxKey = orderedZones[zoneIndex - 1][1];
    nextForm[previousMaxKey] = String(parsedValue - 1);

    for (let index = zoneIndex; index < orderedZones.length; index += 1) {
      const [minKey, maxKey] = orderedZones[index];
      const currentMinValue = parseInt(nextForm[minKey], 10);
      const currentMaxValue = parseInt(nextForm[maxKey], 10);

      if (!Number.isNaN(currentMinValue) && !Number.isNaN(currentMaxValue) && currentMaxValue < currentMinValue) {
        nextForm[maxKey] = '';
        break;
      }
    }
  }

  return nextForm;
}

function fieldClassName() {
  return 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-accent/30';
}

// ─── HR Zone Calculator ───────────────────────────────────────────────────────
function calcZonesFromMaxHR(maxHR) {
  const max = parseInt(maxHR, 10);
  if (!max || max < 100 || max > 230) return null;
  // 5-zone percent model (Friel / classic)
  return {
    hr_zone_1_min: 0,
    hr_zone_1_max: Math.round(max * 0.60),
    hr_zone_2_min: Math.round(max * 0.60) + 1,
    hr_zone_2_max: Math.round(max * 0.70),
    hr_zone_3_min: Math.round(max * 0.70) + 1,
    hr_zone_3_max: Math.round(max * 0.80),
    hr_zone_4_min: Math.round(max * 0.80) + 1,
    hr_zone_4_max: Math.round(max * 0.90),
    hr_zone_5_min: Math.round(max * 0.90) + 1,
    hr_zone_5_max: max,
  };
}

// ─── Tooltip label ────────────────────────────────────────────────────────────
function FieldLabel({ children, tip }) {
  return (
    <label className="mb-1 block">
      <span className="text-sm font-semibold text-ink">{children}</span>
      {tip ? <span className="ml-1.5 text-xs font-normal text-ink/40">{tip}</span> : null}
    </label>
  );
}

function ZoneRow({ label, minName, maxName, form, onChange, zoneDesc }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr_1fr] sm:items-center">
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        {zoneDesc ? <p className="text-[10px] text-ink/40">{zoneDesc}</p> : null}
      </div>
      <input type="number" name={minName} value={form[minName]} onChange={onChange} placeholder="Min bpm" className={fieldClassName()} />
      <input type="number" name={maxName} value={form[maxName]} onChange={onChange} placeholder="Max bpm" className={fieldClassName()} />
      <div className="hidden sm:flex items-center">
        {form[minName] && form[maxName] ? (
          <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-mono text-ink/60">
            {form[minName]}–{form[maxName]} bpm
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, body = null, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-[28px] bg-paper">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 pt-5 pb-4 text-left"
      >
        <div>
          <p className="text-base font-semibold text-ink">{title}</p>
          {body && !open ? <p className="mt-0.5 text-xs text-ink/45">{body}</p> : null}
        </div>
        <span className={`shrink-0 text-ink/30 transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open ? (
        <div className="space-y-4 px-5 pb-5">
          {body ? <p className="text-sm text-ink/55">{body}</p> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

export default function Settings() {
  const [form, setForm] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [calcMaxHR, setCalcMaxHR] = useState('');
  const navLinks = [
    { href: '/dashboard', label: 'Home', description: 'Insights, trends, and recent training.' },
    { href: '/guide', label: 'Guide', description: 'Learn how settings are used.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/settings', label: 'Athlete Settings', description: 'Edit athlete baselines and zones.' },
    { href: '/account', label: 'Account Settings', description: 'Manage account and security.' },
    { href: '/content', label: 'Content', description: 'Track the content and community workstream.' },
    { href: '/', label: 'Landing Page', description: 'Return to the public entry page.' },
  ];

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setForm(toFormValues({ ...data.settings, supplements: data.supplements || [] }));
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

  function handleSupplementChange(index, field, value) {
    setForm((current) => {
      const supplements = current.supplements.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      );

      const lastItem = supplements[supplements.length - 1];
      if (lastItem && (lastItem.supplement_name || lastItem.amount || lastItem.unit || lastItem.frequency_per_day)) {
        const hasRealContent = lastItem.supplement_name || lastItem.amount;
        if (hasRealContent) {
          supplements.push({ supplement_name: '', amount: '', unit: 'mg', frequency_per_day: '1' });
        }
      }

      return { ...current, supplements };
    });
  }

  function removeSupplement(index) {
    setForm((current) => {
      const supplements = current.supplements.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        supplements:
          supplements.length > 0
            ? supplements
            : [{ supplement_name: '', amount: '', unit: 'mg', frequency_per_day: '1' }],
      };
    });
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

    setForm(toFormValues({ ...data.settings, supplements: data.supplements || [] }));
    setMessage('Settings saved.');
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE MY ACCOUNT' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'Delete failed. Please try again.');
        return;
      }
      // Redirect to landing page on success
      window.location.href = '/';
    } catch (_) {
      setDeleteError('Network error. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Athlete Settings</p>
          </div>
          <NavMenu
            label="Athlete settings navigation"
            links={navLinks}
            primaryLink={{ href: '/log-intervention', label: 'Log Intervention' }}
          />
        </div>

        <DashboardTabs activeHref="/settings" />

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Athlete Profile</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">Athlete Settings</h1>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Settings</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Save the baselines you want Threshold to use.</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">You can update these any time.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={handleSubmit} className="space-y-6 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            <Section title="Altitude Baselines" body="Used to contextualize altitude acclimation interventions and flag unusual training elevations.">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel tip="Where you live / sleep">Baseline Sleep Altitude (ft)</FieldLabel>
                  <input type="number" name="baseline_sleep_altitude_ft" value={form.baseline_sleep_altitude_ft} onChange={handleChange} placeholder="e.g. 5280 for Denver" className={fieldClassName()} />
                </div>
                <div>
                  <FieldLabel tip="Where you typically run">Typical Training Altitude (ft)</FieldLabel>
                  <input type="number" name="baseline_training_altitude_ft" value={form.baseline_training_altitude_ft} onChange={handleChange} placeholder="e.g. 6000" className={fieldClassName()} />
                </div>
              </div>
            </Section>

            <Section title="Physiology Anchors" body="Used to calculate bicarb doses, caffeine doses, hydration targets, and HR zone ranges.">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <FieldLabel tip="beats per min, morning">Resting HR</FieldLabel>
                  <input type="number" name="resting_hr" value={form.resting_hr} onChange={handleChange} placeholder="e.g. 48" className={fieldClassName()} />
                </div>
                <div>
                  <FieldLabel tip="used for zone calculator">Max HR</FieldLabel>
                  <input type="number" name="max_hr" value={form.max_hr} onChange={handleChange} placeholder="e.g. 185" className={fieldClassName()} />
                </div>
                <div>
                  <FieldLabel tip="used for dose calculations">Body Weight (lb)</FieldLabel>
                  <input type="number" name="body_weight_lb" value={form.body_weight_lb} onChange={handleChange} placeholder="e.g. 155" className={fieldClassName()} />
                </div>
              </div>
            </Section>

            <Section title="Fueling + Hydration Baselines" body="Your current long-run carb and hydration norms. Used to calculate gaps vs race-day targets in the Race Blueprint.">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel tip="your current gut training baseline">Long-Run Carb Intake (g/hr)</FieldLabel>
                  <input type="number" name="normal_long_run_carb_g_per_hr" value={form.normal_long_run_carb_g_per_hr} onChange={handleChange} placeholder="e.g. 60" className={fieldClassName()} />
                </div>
                <div>
                  <FieldLabel tip="target on long runs in heat">Sweat Rate (L/hr)</FieldLabel>
                  <input type="number" step="0.1" name="sweat_rate_l_per_hr" value={form.sweat_rate_l_per_hr} onChange={handleChange} placeholder="e.g. 1.2" className={fieldClassName()} />
                </div>
                <div>
                  <FieldLabel tip="from sweat test or estimate">Sodium Target (mg/hr)</FieldLabel>
                  <input type="number" name="sodium_target_mg_per_hr" value={form.sodium_target_mg_per_hr} onChange={handleChange} placeholder="e.g. 300" className={fieldClassName()} />
                </div>
                <div>
                  <FieldLabel tip="used for sleep vs performance correlation">Typical Sleep (hours/night)</FieldLabel>
                  <input type="number" step="0.1" name="typical_sleep_hours" value={form.typical_sleep_hours} onChange={handleChange} placeholder="e.g. 7.5" className={fieldClassName()} />
                </div>
                <div>
                  <FieldLabel tip="from sweat sodium test">Sweat Sodium Concentration (mg/L)</FieldLabel>
                  <input type="number" name="sweat_sodium_concentration_mg_l" value={form.sweat_sodium_concentration_mg_l} onChange={handleChange} placeholder="e.g. 900" className={fieldClassName()} />
                </div>
                <div>
                  <FieldLabel tip="ml/hr race-day fluid goal">Fluid Target (ml/hr)</FieldLabel>
                  <input type="number" name="fluid_target_ml_per_hr" value={form.fluid_target_ml_per_hr} onChange={handleChange} placeholder="e.g. 700" className={fieldClassName()} />
                </div>
              </div>
            </Section>

            <Section title="Baseline Supplements">
              <div className="space-y-3">
                {form.supplements.map((item, index) => (
                  <div key={`supplement-${index}`} className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_auto] md:items-center">
                    <input
                      type="text"
                      value={item.supplement_name}
                      onChange={(event) => handleSupplementChange(index, 'supplement_name', event.target.value)}
                      placeholder="Supplement"
                      className={fieldClassName()}
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={item.amount}
                      onChange={(event) => handleSupplementChange(index, 'amount', event.target.value)}
                      placeholder="Amount"
                      className={fieldClassName()}
                    />
                    <select
                      value={item.unit}
                      onChange={(event) => handleSupplementChange(index, 'unit', event.target.value)}
                      className={fieldClassName()}
                    >
                      {['mg', 'g', 'mcg', 'capsule', 'tablet', 'scoop', 'serving', 'ml'].map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.frequency_per_day}
                      onChange={(event) => handleSupplementChange(index, 'frequency_per_day', event.target.value)}
                      placeholder="Per day"
                      className={fieldClassName()}
                    />
                    {item.supplement_name || item.amount ? (
                      <button
                        type="button"
                        onClick={() => removeSupplement(index)}
                        className="rounded-full border border-ink/10 px-4 py-3 text-sm font-semibold text-ink"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Heart Rate Zones" body="Zone 2 ceiling is used by the Race Blueprint and AI analysis to flag aerobic drift. Set these manually or use the calculator.">
              {/* Zone calculator */}
              <div className="rounded-[18px] border border-accent/25 bg-accent/6 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Zone Calculator</p>
                <p className="mt-1 text-xs text-ink/55">Enter your max HR and click Calculate to auto-fill all zones using the standard 5-zone % model.</p>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    value={calcMaxHR || form.max_hr}
                    onChange={(e) => setCalcMaxHR(e.target.value)}
                    placeholder="Max HR (bpm)"
                    className="w-36 rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const zones = calcZonesFromMaxHR(calcMaxHR || form.max_hr);
                      if (!zones) return;
                      setForm((prev) => ({
                        ...prev,
                        ...Object.fromEntries(Object.entries(zones).map(([k, v]) => [k, String(v)])),
                      }));
                    }}
                    className="rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-paper"
                  >
                    Calculate zones →
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="hidden grid-cols-[100px_1fr_1fr_1fr] gap-3 sm:grid">
                  <span />
                  <span className="text-xs font-semibold text-ink/40">Min bpm</span>
                  <span className="text-xs font-semibold text-ink/40">Max bpm</span>
                  <span />
                </div>
                <ZoneRow label="Zone 1" zoneDesc="< 60% · Recovery" minName="hr_zone_1_min" maxName="hr_zone_1_max" form={form} onChange={handleChange} />
                <ZoneRow label="Zone 2" zoneDesc="60-70% · Aerobic base" minName="hr_zone_2_min" maxName="hr_zone_2_max" form={form} onChange={handleChange} />
                <ZoneRow label="Zone 3" zoneDesc="70-80% · Tempo" minName="hr_zone_3_min" maxName="hr_zone_3_max" form={form} onChange={handleChange} />
                <ZoneRow label="Zone 4" zoneDesc="80-90% · Threshold" minName="hr_zone_4_min" maxName="hr_zone_4_max" form={form} onChange={handleChange} />
                <ZoneRow label="Zone 5" zoneDesc="90-100% · VO2 max" minName="hr_zone_5_min" maxName="hr_zone_5_max" form={form} onChange={handleChange} />
              </div>
            </Section>

            <Section title="Notes">
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={5} className={fieldClassName()} />
            </Section>

            <div className="flex items-center gap-4">
              <button type="submit" className="rounded-full bg-ink px-8 py-3 text-sm font-semibold text-paper shadow-[0_4px_14px_rgba(19,24,22,0.18)] transition hover:opacity-90">
                Save Settings
              </button>
              {message === 'Settings saved.' ? (
                <span className="text-sm font-semibold text-emerald-600">✓ Saved</span>
              ) : message ? (
                <span className="text-sm text-red-600">{message}</span>
              ) : null}
            </div>
          </form>

          <aside className="space-y-5">
            <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Need help?</p>
              <p className="mt-4 text-sm leading-6 text-ink/75">
                Open the guide for a quick explanation of what these settings affect.
              </p>
              <a href="/guide" className="mt-4 inline-flex rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink">
                Open Guide
              </a>
            </div>

            {/* Danger zone */}
            <div className="rounded-[30px] border border-red-200 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">Danger Zone</p>
              <p className="mt-3 text-sm leading-6 text-ink/70">
                Permanently delete your account and all training data. This cannot be undone.
              </p>
              {!showDeleteZone ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteZone(true)}
                  className="mt-4 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Delete account…
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-xs leading-5 text-ink/60">
                    Type <strong>DELETE MY ACCOUNT</strong> to confirm. All your interventions, settings, and data will be erased immediately.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="w-full rounded-2xl border border-red-200 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  {deleteError ? (
                    <p className="text-xs text-red-600">{deleteError}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE MY ACCOUNT' || deleteLoading}
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
                    >
                      {deleteLoading ? 'Deleting…' : 'Delete everything'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDeleteZone(false); setDeleteConfirmText(''); setDeleteError(''); }}
                      className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink/60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
