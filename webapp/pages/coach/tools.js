import { useMemo, useState } from 'react';
import NavMenu from '../../components/NavMenu';
import DashboardTabs from '../../components/DashboardTabs';
import UpgradePrompt from '../../components/UpgradePrompt';
import { usePlan } from '../../lib/planUtils';
import { appMenuLinks } from '../../lib/siteNavigation';

// ─── Shared time / pace helpers ──────────────────────────────────────────────

function parseTimeToSeconds(value) {
  if (!value) return null;
  const parts = String(value).trim().split(':').map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60; // bare minutes
  return null;
}

function fmtTime(totalSeconds) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtPace(secondsPerUnit, suffix) {
  if (secondsPerUnit == null || !Number.isFinite(secondsPerUnit)) return '—';
  return `${fmtTime(secondsPerUnit)}${suffix}`;
}

const RACE_DISTANCES = [
  { id: 'mile', label: 'Mile', meters: 1609.34 },
  { id: '5k', label: '5K', meters: 5000 },
  { id: '10k', label: '10K', meters: 10000 },
  { id: 'half', label: 'Half Marathon', meters: 21097.5 },
  { id: 'marathon', label: 'Marathon', meters: 42195 },
  { id: '50k', label: '50K', meters: 50000 },
  { id: '100k', label: '100K', meters: 100000 },
];

// ─── Card scaffold ───────────────────────────────────────────────────────────

function ToolCard({ eyebrow, title, blurb, children }) {
  return (
    <article className="rounded-[28px] border border-ink/10 bg-white p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
      <h2 className="mt-1.5 text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-ink/55">{blurb}</p>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink/55">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink focus:border-accent/50 focus:outline-none';

function ZoneTable({ rows, valueHeader = 'Range' }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-paper text-left text-[11px] uppercase tracking-wide text-ink/50">
            <th className="px-3 py-2">Zone</th>
            <th className="px-3 py-2">Purpose</th>
            <th className="px-3 py-2 text-right">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.zone} className="border-t border-ink/6">
              <td className="px-3 py-2 font-semibold text-ink/80">{row.zone}</td>
              <td className="px-3 py-2 text-xs text-ink/60">{row.purpose}</td>
              <td className="px-3 py-2 text-right font-mono text-ink">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 1. Heart-rate zone calculator ───────────────────────────────────────────

function HrZoneCalculator() {
  const [method, setMethod] = useState('lthr');
  const [maxHr, setMaxHr] = useState('185');
  const [restingHr, setRestingHr] = useState('52');
  const [lthr, setLthr] = useState('168');

  const rows = useMemo(() => {
    const max = Number(maxHr) || 0;
    const rest = Number(restingHr) || 0;
    const lt = Number(lthr) || 0;

    const pct = (lo, hi, base) => `${Math.round(base * lo)}–${Math.round(base * hi)} bpm`;
    const karv = (lo, hi) => `${Math.round(rest + (max - rest) * lo)}–${Math.round(rest + (max - rest) * hi)} bpm`;

    if (method === 'max' && max > 0) {
      return [
        { zone: 'Z1 Recovery', purpose: 'Active recovery, warm ups', value: pct(0.5, 0.6, max) },
        { zone: 'Z2 Endurance', purpose: 'Aerobic base, most volume', value: pct(0.6, 0.7, max) },
        { zone: 'Z3 Tempo', purpose: 'Steady “comfortably hard”', value: pct(0.7, 0.8, max) },
        { zone: 'Z4 Threshold', purpose: 'Lactate threshold work', value: pct(0.8, 0.9, max) },
        { zone: 'Z5 VO2max', purpose: 'Short hard intervals', value: pct(0.9, 1.0, max) },
      ];
    }
    if (method === 'karvonen' && max > rest && rest > 0) {
      return [
        { zone: 'Z1 Recovery', purpose: 'Active recovery, warm ups', value: karv(0.5, 0.6) },
        { zone: 'Z2 Endurance', purpose: 'Aerobic base, most volume', value: karv(0.6, 0.7) },
        { zone: 'Z3 Tempo', purpose: 'Steady “comfortably hard”', value: karv(0.7, 0.8) },
        { zone: 'Z4 Threshold', purpose: 'Lactate threshold work', value: karv(0.8, 0.9) },
        { zone: 'Z5 VO2max', purpose: 'Short hard intervals', value: karv(0.9, 1.0) },
      ];
    }
    if (method === 'lthr' && lt > 0) {
      const ltPct = (lo, hi) => (hi ? `${Math.round(lt * lo)}–${Math.round(lt * hi)} bpm` : `> ${Math.round(lt * lo)} bpm`);
      return [
        { zone: 'Z1 Recovery', purpose: 'Active recovery', value: `< ${Math.round(lt * 0.85)} bpm` },
        { zone: 'Z2 Aerobic', purpose: 'Aerobic base, most volume', value: ltPct(0.85, 0.89) },
        { zone: 'Z3 Tempo', purpose: 'Steady state', value: ltPct(0.9, 0.94) },
        { zone: 'Z4 SubThreshold', purpose: 'Cruise intervals', value: ltPct(0.95, 0.99) },
        { zone: 'Z5a Threshold', purpose: 'At/just above LT', value: ltPct(1.0, 1.02) },
        { zone: 'Z5b VO2max', purpose: '3–8 min intervals', value: ltPct(1.03, 1.06) },
        { zone: 'Z5c Anaerobic', purpose: 'Short reps, speed', value: ltPct(1.07) },
      ];
    }
    return [];
  }, [method, maxHr, restingHr, lthr]);

  return (
    <ToolCard
      eyebrow="Any sport"
      title="Heart-Rate Zone Calculator"
      blurb="Three methods: simple % of max HR, Karvonen (heart-rate reserve, accounts for resting HR), or Friel-style zones anchored on lactate threshold HR from a 30-minute time trial."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            <option value="lthr">LTHR (Friel 7-zone)</option>
            <option value="karvonen">Karvonen (HR reserve)</option>
            <option value="max">% of Max HR</option>
          </select>
        </Field>
        {method === 'lthr' ? (
          <Field label="Lactate threshold HR (bpm)">
            <input type="number" value={lthr} onChange={(e) => setLthr(e.target.value)} className={inputCls} />
          </Field>
        ) : (
          <Field label="Max HR (bpm)">
            <input type="number" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} className={inputCls} />
          </Field>
        )}
        {method === 'karvonen' && (
          <Field label="Resting HR (bpm)">
            <input type="number" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} className={inputCls} />
          </Field>
        )}
      </div>
      {rows.length ? <ZoneTable rows={rows} /> : <p className="mt-3 text-xs text-ink/50">Enter valid heart rates to see zones.</p>}
    </ToolCard>
  );
}

// ─── 2. Race predictor (Riegel) ──────────────────────────────────────────────

function RacePredictor() {
  const [distanceId, setDistanceId] = useState('10k');
  const [time, setTime] = useState('42:00');
  const [exponent, setExponent] = useState('1.06');

  const predictions = useMemo(() => {
    const known = RACE_DISTANCES.find((d) => d.id === distanceId);
    const t1 = parseTimeToSeconds(time);
    const exp = Number(exponent) || 1.06;
    if (!known || !t1) return [];
    return RACE_DISTANCES.filter((d) => d.id !== distanceId).map((d) => {
      const t2 = t1 * (d.meters / known.meters) ** exp;
      return {
        zone: d.label,
        purpose: `${(d.meters / 1609.34).toFixed(1)} mi`,
        value: `${fmtTime(t2)} (${fmtPace(t2 / (d.meters / 1609.34), '/mi')})`,
      };
    });
  }, [distanceId, time, exponent]);

  return (
    <ToolCard
      eyebrow="Running"
      title="Race Time Predictor"
      blurb="Riegel power-law prediction from one known result. The default exponent 1.06 fits trained runners; raise it toward 1.10–1.15 for athletes with a thin endurance base or for ultra distances."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Known race">
          <select value={distanceId} onChange={(e) => setDistanceId(e.target.value)} className={inputCls}>
            {RACE_DISTANCES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Finish time (h:mm:ss)">
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="42:00" className={inputCls} />
        </Field>
        <Field label="Fatigue exponent">
          <input type="number" step="0.01" min="1" max="1.3" value={exponent} onChange={(e) => setExponent(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {predictions.length ? <ZoneTable rows={predictions} valueHeader="Predicted" /> : <p className="mt-3 text-xs text-ink/50">Enter a valid time (e.g. 42:00 or 3:10:00).</p>}
    </ToolCard>
  );
}

// ─── 3. Training paces from a race result ────────────────────────────────────

function TrainingPaces() {
  const [distanceId, setDistanceId] = useState('5k');
  const [time, setTime] = useState('20:00');

  const rows = useMemo(() => {
    const known = RACE_DISTANCES.find((d) => d.id === distanceId);
    const t1 = parseTimeToSeconds(time);
    if (!known || !t1) return [];
    const exp = 1.06;
    const predictTime = (meters) => t1 * (meters / known.meters) ** exp;
    const paceAt = (meters) => predictTime(meters) / (meters / 1609.34); // sec per mile

    // Threshold ≈ pace you could race for one hour (solve Riegel for T = 3600)
    const hourDistance = known.meters * (3600 / t1) ** (1 / exp);
    const thresholdPace = 3600 / (hourDistance / 1609.34);

    return [
      { zone: 'Easy / Long run', purpose: 'Conversational aerobic volume', value: `${fmtPace(thresholdPace * 1.28, '')}–${fmtPace(thresholdPace * 1.42, '/mi')}` },
      { zone: 'Marathon pace', purpose: 'Steady endurance work', value: fmtPace(paceAt(42195), '/mi') },
      { zone: 'Threshold', purpose: 'Cruise intervals, tempo (≈1 hr race pace)', value: fmtPace(thresholdPace, '/mi') },
      { zone: 'Interval / VO2max', purpose: '3–5 min repeats (≈3K race pace)', value: fmtPace(paceAt(3000), '/mi') },
      { zone: 'Repetition', purpose: 'Short fast reps (≈mile race pace)', value: fmtPace(paceAt(1609.34), '/mi') },
    ];
  }, [distanceId, time]);

  return (
    <ToolCard
      eyebrow="Running"
      title="Training Pace Calculator"
      blurb="Daniels-style training paces derived from a recent race: threshold is modeled as one-hour race pace, VO2max as 3K pace, repetition as mile pace, with an easy range above threshold."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Recent race">
          <select value={distanceId} onChange={(e) => setDistanceId(e.target.value)} className={inputCls}>
            {RACE_DISTANCES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Finish time (h:mm:ss)">
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="20:00" className={inputCls} />
        </Field>
      </div>
      {rows.length ? <ZoneTable rows={rows} valueHeader="Pace" /> : <p className="mt-3 text-xs text-ink/50">Enter a valid race time.</p>}
    </ToolCard>
  );
}

// ─── 4. Cycling power zones (Coggan) ─────────────────────────────────────────

function PowerZones() {
  const [ftp, setFtp] = useState('250');

  const rows = useMemo(() => {
    const f = Number(ftp) || 0;
    if (!f) return [];
    const band = (lo, hi) => (hi ? `${Math.round(f * lo)}–${Math.round(f * hi)} W` : `> ${Math.round(f * lo)} W`);
    return [
      { zone: 'Z1 Recovery', purpose: 'Spin-out, recovery rides', value: `< ${Math.round(f * 0.55)} W` },
      { zone: 'Z2 Endurance', purpose: 'Aerobic base', value: band(0.56, 0.75) },
      { zone: 'Z3 Tempo', purpose: 'Brisk group-ride pace', value: band(0.76, 0.9) },
      { zone: 'Z4 Threshold', purpose: '8–30 min intervals at FTP', value: band(0.91, 1.05) },
      { zone: 'Z5 VO2max', purpose: '3–8 min intervals', value: band(1.06, 1.2) },
      { zone: 'Z6 Anaerobic', purpose: '30 s – 3 min efforts', value: band(1.21, 1.5) },
      { zone: 'Z7 Neuromuscular', purpose: 'Sprints', value: band(1.51) },
    ];
  }, [ftp]);

  return (
    <ToolCard
      eyebrow="Cycling"
      title="Power Zone Calculator"
      blurb="Coggan seven-zone model from FTP (best ~60-minute power, or 95% of a 20-minute test)."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="FTP (watts)">
          <input type="number" value={ftp} onChange={(e) => setFtp(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {rows.length ? <ZoneTable rows={rows} valueHeader="Power" /> : null}
    </ToolCard>
  );
}

// ─── 5. Swim CSS ─────────────────────────────────────────────────────────────

function SwimCss() {
  const [t400, setT400] = useState('6:20');
  const [t200, setT200] = useState('3:02');

  const result = useMemo(() => {
    const s400 = parseTimeToSeconds(t400);
    const s200 = parseTimeToSeconds(t200);
    if (!s400 || !s200 || s400 <= s200) return null;
    const cssSpeed = 200 / (s400 - s200); // m/s
    const per100 = 100 / cssSpeed;
    return {
      per100,
      rows: [
        { zone: 'Easy / Recovery', purpose: 'Drills, warm ups', value: fmtPace(per100 * 1.1, '/100m') },
        { zone: 'Endurance', purpose: 'Long steady sets', value: fmtPace(per100 * 1.05, '/100m') },
        { zone: 'CSS / Threshold', purpose: '100–400 m repeats, short rest', value: fmtPace(per100, '/100m') },
        { zone: 'VO2max', purpose: '50–100 m repeats', value: fmtPace(per100 * 0.95, '/100m') },
        { zone: 'Sprint', purpose: '25–50 m all-out', value: fmtPace(per100 * 0.88, '/100m') },
      ],
    };
  }, [t400, t200]);

  return (
    <ToolCard
      eyebrow="Swimming"
      title="Critical Swim Speed (CSS)"
      blurb="From 400 m and 200 m time trials: CSS approximates the pace a swimmer can hold for an extended threshold set, the anchor for pool zone targets."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="400 m TT (m:ss)">
          <input value={t400} onChange={(e) => setT400(e.target.value)} className={inputCls} />
        </Field>
        <Field label="200 m TT (m:ss)">
          <input value={t200} onChange={(e) => setT200(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {result ? (
        <>
          <p className="mt-3 text-sm text-ink/70">CSS pace: <span className="font-mono font-semibold text-ink">{fmtPace(result.per100, '/100m')}</span></p>
          <ZoneTable rows={result.rows} valueHeader="Pace" />
        </>
      ) : <p className="mt-3 text-xs text-ink/50">Enter both time trials (400 must be slower than 200).</p>}
    </ToolCard>
  );
}

// ─── 6. Pace / speed converter ───────────────────────────────────────────────

function PaceConverter() {
  const [distance, setDistance] = useState('26.2');
  const [unit, setUnit] = useState('mi');
  const [time, setTime] = useState('3:30:00');

  const result = useMemo(() => {
    const dist = Number(distance) || 0;
    const seconds = parseTimeToSeconds(time);
    if (!dist || !seconds) return null;
    const miles = unit === 'mi' ? dist : dist / 1.60934;
    const km = unit === 'km' ? dist : dist * 1.60934;
    return {
      perMile: seconds / miles,
      perKm: seconds / km,
      mph: miles / (seconds / 3600),
      kph: km / (seconds / 3600),
    };
  }, [distance, unit, time]);

  return (
    <ToolCard
      eyebrow="Any sport"
      title="Pace & Speed Converter"
      blurb="Goal time to required pace in both unit systems — useful for splits, treadmill settings, and pacing plans."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Distance">
          <input type="number" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
            <option value="mi">miles</option>
            <option value="km">kilometers</option>
          </select>
        </Field>
        <Field label="Goal time (h:mm:ss)">
          <input value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {result && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'per mile', value: fmtTime(result.perMile) },
            { label: 'per km', value: fmtTime(result.perKm) },
            { label: 'mph', value: result.mph.toFixed(2) },
            { label: 'km/h', value: result.kph.toFixed(2) },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl bg-paper px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-ink/45">{m.label}</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-ink">{m.value}</p>
            </div>
          ))}
        </div>
      )}
    </ToolCard>
  );
}

// ─── 7. Training load ramp planner ───────────────────────────────────────────

function RampPlanner() {
  const [currentCtl, setCurrentCtl] = useState('45');
  const [targetCtl, setTargetCtl] = useState('70');
  const [weeks, setWeeks] = useState('12');

  const result = useMemo(() => {
    const ctl0 = Number(currentCtl) || 0;
    const ctl1 = Number(targetCtl) || 0;
    const w = Number(weeks) || 0;
    if (!w || ctl1 <= 0) return null;
    const rampPerWeek = (ctl1 - ctl0) / w;
    // CTL is an EWMA of daily TSS: to hold a CTL you average that TSS daily.
    // To ramp, weekly TSS ≈ 7 × (target CTL along the ramp), approximated at
    // the midpoint plus the ramp overhead.
    const midCtl = ctl0 + (ctl1 - ctl0) / 2;
    const weeklyTssStart = Math.round(7 * (ctl0 + rampPerWeek * 6));
    const weeklyTssEnd = Math.round(7 * (ctl1 + rampPerWeek * 6));
    return {
      rampPerWeek,
      weeklyTssStart,
      weeklyTssEnd,
      midWeeklyTss: Math.round(7 * (midCtl + rampPerWeek * 6)),
      risky: rampPerWeek > 8,
      caution: rampPerWeek > 5 && rampPerWeek <= 8,
    };
  }, [currentCtl, targetCtl, weeks]);

  return (
    <ToolCard
      eyebrow="Multi-sport"
      title="Training Load Ramp Planner"
      blurb="Plan a fitness (CTL) build: how much weekly TSS the block needs and whether the ramp rate is sustainable. Guideline: +3–5 CTL/week is sustainable, +5–8 aggressive, above +8 high injury/illness risk."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Current CTL (fitness)">
          <input type="number" value={currentCtl} onChange={(e) => setCurrentCtl(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Target CTL">
          <input type="number" value={targetCtl} onChange={(e) => setTargetCtl(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Weeks available">
          <input type="number" value={weeks} onChange={(e) => setWeeks(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {result && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Ramp / week', value: `${result.rampPerWeek >= 0 ? '+' : ''}${result.rampPerWeek.toFixed(1)}` },
              { label: 'Weekly TSS (start)', value: result.weeklyTssStart },
              { label: 'Weekly TSS (end)', value: result.weeklyTssEnd },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl bg-paper px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-ink/45">{m.label}</p>
                <p className="mt-0.5 font-mono text-lg font-semibold text-ink">{m.value}</p>
              </div>
            ))}
          </div>
          {result.risky && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Warning: ramp above +8 CTL/week — high overuse risk. Add weeks or lower the target.
            </p>
          )}
          {result.caution && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Aggressive ramp (+5–8 CTL/week). Watch recovery markers and plan deload weeks.
            </p>
          )}
        </div>
      )}
    </ToolCard>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CoachToolsPage() {
  const { coachFeatures, planReady } = usePlan();

  if (!planReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-ink/55">Loading Coach Tools…</p>
      </main>
    );
  }

  if (!coachFeatures) {
    return (
      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold · Coach Tools</p>
            <NavMenu label="Navigation" links={appMenuLinks} primaryLink={{ href: '/dashboard', label: 'Home', variant: 'secondary' }} />
          </div>
          <section className="mt-12">
            <UpgradePrompt
              featureName="Coach Tools"
              unlockTier="Coach Monthly or Coach Annual"
              body="Zone calculators, race predictors, and load-planning tools for every endurance discipline are part of the Coach plan."
            />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold · Coach Tools</p>
          <NavMenu label="Navigation" links={appMenuLinks} primaryLink={{ href: '/coach-command-center', label: 'Command Center', variant: 'secondary' }} />
        </div>

        <DashboardTabs
          activeHref="/coach/tools"
          tabs={[
            { href: '/coach-command-center', label: 'Coach Command Center' },
            { href: '/coach/training-calendar', label: 'Training Calendar' },
            { href: '/coach/tools', label: 'Coach Tools' },
          ]}
        />

        <section className="overflow-hidden rounded-[28px] border border-ink/10 bg-[linear-gradient(140deg,#1b2421_0%,#26332f_42%,#857056_100%)] px-6 py-5 text-white">
          <h1 className="font-display text-3xl leading-tight">Coach Tools</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/65">
            Field-tested calculators across running, cycling, swimming, and general endurance —
            zones, race predictions, training paces, and load planning in one place.
          </p>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <HrZoneCalculator />
          <RacePredictor />
          <TrainingPaces />
          <PowerZones />
          <SwimCss />
          <PaceConverter />
          <RampPlanner />
        </section>
      </div>
    </main>
  );
}
