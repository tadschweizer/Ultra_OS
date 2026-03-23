import { useEffect, useState } from 'react';
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
  supplements: [{ supplement_name: '', dose: '' }],
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
    supplements:
      settings.supplements && settings.supplements.length > 0
        ? settings.supplements.map((item) => ({
            supplement_name: item.supplement_name ?? '',
            dose: item.dose ?? '',
          }))
        : [{ supplement_name: '', dose: '' }],
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

function fieldClassName() {
  return 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink';
}

function ZoneRow({ label, minName, maxName, form, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[80px_1fr_1fr] sm:items-center">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <input type="number" name={minName} value={form[minName]} onChange={onChange} placeholder="Min" className={fieldClassName()} />
      <input type="number" name={maxName} value={form[maxName]} onChange={onChange} placeholder="Max" className={fieldClassName()} />
    </div>
  );
}

function Section({ title, body, children }) {
  return (
    <section className="space-y-4 rounded-[28px] bg-paper p-5">
      <div>
        <p className="text-lg font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink/65">{body}</p>
      </div>
      {children}
    </section>
  );
}

export default function Settings() {
  const [form, setForm] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/settings', label: 'Settings', description: 'Edit athlete baselines and zones.' },
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
      if (lastItem && (lastItem.supplement_name || lastItem.dose)) {
        supplements.push({ supplement_name: '', dose: '' });
      }

      return { ...current, supplements };
    });
  }

  function removeSupplement(index) {
    setForm((current) => {
      const supplements = current.supplements.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        supplements: supplements.length > 0 ? supplements : [{ supplement_name: '', dose: '' }],
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

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Settings</p>
          </div>
          <NavMenu
            label="Settings navigation"
            links={navLinks}
            primaryLink={{ href: '/log-intervention', label: 'Log Intervention' }}
          />
        </div>

        <DashboardTabs activeHref="/settings" />

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Athlete Profile</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">Save the baselines that make your data interpretable.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                UltraOS needs stable anchors for altitude, fueling, hydration, sleep, and heart rate. This page is where those inputs live.
              </p>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Why These Matter</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Altitude and sleep location</p>
                  <p className="mt-2 text-sm text-white/75">These make altitude tent work and high-elevation training sessions interpretable.</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Fueling and hydration baselines</p>
                  <p className="mt-2 text-sm text-white/75">Carbs, sodium, and sweat rate create meaningful comparisons across intervention blocks.</p>
                </div>
                <div className="rounded-[24px] border border-accent/30 bg-accent/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Next Integration Path</p>
                  <p className="mt-2 text-sm text-white/80">Resting HR can stay manual now and later be updated by Garmin or another wearable source.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={handleSubmit} className="space-y-6 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            {message ? <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">{message}</p> : null}

            <Section title="Altitude Baselines" body="These anchor altitude tent, camp, and high-elevation workout interpretation.">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Baseline Sleep Altitude (ft)</label>
                  <input type="number" name="baseline_sleep_altitude_ft" value={form.baseline_sleep_altitude_ft} onChange={handleChange} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Typical Training Altitude (ft)</label>
                  <input type="number" name="baseline_training_altitude_ft" value={form.baseline_training_altitude_ft} onChange={handleChange} className={fieldClassName()} />
                </div>
              </div>
            </Section>

            <Section title="Physiology Anchors" body="These are stable enough to improve interpretation before wearable integrations are live.">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Resting HR</label>
                  <input type="number" name="resting_hr" value={form.resting_hr} onChange={handleChange} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Max HR</label>
                  <input type="number" name="max_hr" value={form.max_hr} onChange={handleChange} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Body Weight (lb)</label>
                  <input type="number" name="body_weight_lb" value={form.body_weight_lb} onChange={handleChange} className={fieldClassName()} />
                </div>
              </div>
            </Section>

            <Section title="Fueling + Hydration Baselines" body="These are practical reference points for gut training, sodium, and race-day intervention review.">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Normal Long-Run Carbs (g/hr)</label>
                  <input type="number" name="normal_long_run_carb_g_per_hr" value={form.normal_long_run_carb_g_per_hr} onChange={handleChange} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Sodium Target (mg/hr)</label>
                  <input type="number" name="sodium_target_mg_per_hr" value={form.sodium_target_mg_per_hr} onChange={handleChange} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Sweat Rate (L/hr)</label>
                  <input type="number" step="0.1" name="sweat_rate_l_per_hr" value={form.sweat_rate_l_per_hr} onChange={handleChange} className={fieldClassName()} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Typical Sleep (hours)</label>
                  <input type="number" step="0.1" name="typical_sleep_hours" value={form.typical_sleep_hours} onChange={handleChange} className={fieldClassName()} />
                </div>
              </div>
            </Section>

            <Section title="Baseline Supplements" body="Track the supplements you regularly take so the dashboard can start comparing training and intervention trends against your baseline stack.">
              <div className="space-y-3">
                {form.supplements.map((item, index) => (
                  <div key={`supplement-${index}`} className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                    <input
                      type="text"
                      value={item.supplement_name}
                      onChange={(event) => handleSupplementChange(index, 'supplement_name', event.target.value)}
                      placeholder="Supplement"
                      className={fieldClassName()}
                    />
                    <input
                      type="text"
                      value={item.dose}
                      onChange={(event) => handleSupplementChange(index, 'dose', event.target.value)}
                      placeholder="Dose"
                      className={fieldClassName()}
                    />
                    {item.supplement_name || item.dose ? (
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

            <Section title="Heart Rate Zones" body="If you enter a zone max, the next zone min auto-fills as one beat higher. Example: Zone 2 max 150 sets Zone 3 min to 151.">
              <div className="space-y-3">
                <ZoneRow label="Zone 1" minName="hr_zone_1_min" maxName="hr_zone_1_max" form={form} onChange={handleChange} />
                <ZoneRow label="Zone 2" minName="hr_zone_2_min" maxName="hr_zone_2_max" form={form} onChange={handleChange} />
                <ZoneRow label="Zone 3" minName="hr_zone_3_min" maxName="hr_zone_3_max" form={form} onChange={handleChange} />
                <ZoneRow label="Zone 4" minName="hr_zone_4_min" maxName="hr_zone_4_max" form={form} onChange={handleChange} />
                <ZoneRow label="Zone 5" minName="hr_zone_5_min" maxName="hr_zone_5_max" form={form} onChange={handleChange} />
              </div>
            </Section>

            <Section title="Notes" body="Stable context that matters later: heat tolerance, GI triggers, regular sleep location shifts, and similar anchors.">
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={5} className={fieldClassName()} />
            </Section>

            <button type="submit" className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">Save Settings</button>
          </form>

          <aside className="space-y-5">
            <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Helpful Baselines</p>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                <li>Sleep altitude and training altitude make altitude tent work interpretable.</li>
                <li>Body weight matters for protocols dosed per kilogram and hydration analysis.</li>
                <li>Carb, sweat, and sodium baselines make fueling interventions comparable across sessions.</li>
                <li>Typical sleep hours make sleep interventions more meaningful than a free-text note alone.</li>
              </ul>
            </div>

            <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">How This Feeds Insights</p>
              <p className="mt-4 text-sm leading-6 text-ink/75">
                UltraOS is trying to compare intervention blocks against training response. Without stable baselines, later AI claims would be weak.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
