import { useEffect, useMemo, useRef, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import { getLoadMetrics } from '../lib/trainingLoad';

function startOfDay(dateLike) { const d = new Date(dateLike); d.setHours(0, 0, 0, 0); return d; }

// Validated chart palette (light surface): fitness amber, fatigue cyan, form violet.
const COLOR_CTL = '#B45309';
const COLOR_ATL = '#0891B2';
const COLOR_TSB = '#7C3AED';
const COLOR_BAR = 'rgba(19,24,22,0.14)';
const COLOR_GRID = 'rgba(19,24,22,0.08)';
const COLOR_TEXT = 'rgba(19,24,22,0.55)';

function niceTicks(maxValue, count = 4) {
  const raw = maxValue / count;
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
  return Array.from({ length: count + 1 }).map((_, i) => i * step);
}

function fmtDateShort(key) {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Performance-management chart: daily TRIMP bars with ATL/CTL EWMA lines,
 * crosshair hover tooltip, y-gridlines, and end-of-line direct labels.
 */
function LoadChart({ dailyLoad, acuteSeries, chronicSeries, formSeries }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const W = 680;
  const H = 240;
  const PAD_L = 34;
  const PAD_R = 44;
  const PAD_T = 10;
  const PAD_B = 22;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const n = dailyLoad.length;
  const maxVal = Math.max(...dailyLoad.map((d) => d.load), ...acuteSeries, ...chronicSeries, 10);
  const ticks = niceTicks(maxVal);
  const yMax = ticks[ticks.length - 1];

  const x = (i) => PAD_L + (i / Math.max(n - 1, 1)) * plotW;
  const y = (v) => PAD_T + plotH - (v / yMax) * plotH;

  const linePath = (series) => series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const barWidth = Math.max(1.5, (plotW / n) * 0.62);

  function handleMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - PAD_L) / plotW) * (n - 1));
    setHoverIdx(idx >= 0 && idx < n ? idx : null);
  }

  const hover = hoverIdx != null ? {
    idx: hoverIdx,
    date: dailyLoad[hoverIdx].date,
    load: dailyLoad[hoverIdx].load,
    atl: acuteSeries[hoverIdx],
    ctl: chronicSeries[hoverIdx],
    tsb: formSeries[hoverIdx],
  } : null;

  // Month boundary ticks along the x-axis
  const monthTicks = dailyLoad.reduce((acc, d, i) => {
    if (i === 0 || d.date.slice(8, 10) === '01') acc.push({ i, label: new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short' }) });
    return acc;
  }, []);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Grid + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} y1={y(t)} x2={W - PAD_R} y2={y(t)} stroke={COLOR_GRID} strokeWidth="1" />
            <text x={PAD_L - 6} y={y(t) + 3.5} fontSize="9.5" fill={COLOR_TEXT} textAnchor="end">{t}</text>
          </g>
        ))}
        {monthTicks.map((m) => (
          <text key={m.i} x={x(m.i)} y={H - 6} fontSize="9.5" fill={COLOR_TEXT} textAnchor="middle">{m.label}</text>
        ))}

        {/* Daily load bars */}
        {dailyLoad.map((d, i) => d.load > 0 ? (
          <rect
            key={d.date}
            x={x(i) - barWidth / 2}
            y={y(d.load)}
            width={barWidth}
            height={Math.max(0, PAD_T + plotH - y(d.load))}
            rx="1.5"
            fill={COLOR_BAR}
          />
        ) : null)}

        {/* EWMA lines */}
        <path d={linePath(chronicSeries)} fill="none" stroke={COLOR_CTL} strokeWidth="2.5" strokeLinejoin="round" />
        <path d={linePath(acuteSeries)} fill="none" stroke={COLOR_ATL} strokeWidth="2" strokeLinejoin="round" />

        {/* Direct end labels */}
        <text x={W - PAD_R + 4} y={y(chronicSeries[n - 1]) + 3.5} fontSize="10" fontWeight="700" fill={COLOR_CTL}>CTL</text>
        <text x={W - PAD_R + 4} y={y(acuteSeries[n - 1]) + 3.5} fontSize="10" fontWeight="700" fill={COLOR_ATL}>ATL</text>

        {/* Crosshair */}
        {hover && (
          <g>
            <line x1={x(hover.idx)} y1={PAD_T} x2={x(hover.idx)} y2={PAD_T + plotH} stroke="rgba(19,24,22,0.3)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover.idx)} cy={y(hover.ctl)} r="4" fill={COLOR_CTL} stroke="#fff" strokeWidth="2" />
            <circle cx={x(hover.idx)} cy={y(hover.atl)} r="4" fill={COLOR_ATL} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(82, Math.max(2, (hover.idx / n) * 100))}%` }}
        >
          <p className="font-semibold text-ink">{fmtDateShort(hover.date)}</p>
          <p className="mt-0.5 text-ink/60">Load <span className="font-mono font-semibold text-ink">{hover.load.toFixed(0)}</span></p>
          <p className="text-ink/60"><span style={{ color: COLOR_CTL }}>●</span> Fitness <span className="font-mono font-semibold text-ink">{hover.ctl.toFixed(1)}</span></p>
          <p className="text-ink/60"><span style={{ color: COLOR_ATL }}>●</span> Fatigue <span className="font-mono font-semibold text-ink">{hover.atl.toFixed(1)}</span></p>
          <p className="text-ink/60"><span style={{ color: COLOR_TSB }}>●</span> Form <span className="font-mono font-semibold text-ink">{hover.tsb.toFixed(1)}</span></p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink/65">
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COLOR_CTL }} />Fitness — CTL, 42-day weighted load</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COLOR_ATL }} />Fatigue — ATL, 7-day weighted load</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COLOR_BAR }} />Daily training load (TRIMP)</span>
      </div>
    </div>
  );
}

/** Form (TSB) chart: diverging area around a zero baseline. */
function FormChart({ formSeries }) {
  const W = 680;
  const H = 120;
  const PAD_L = 34;
  const PAD_R = 44;
  const PAD_T = 8;
  const PAD_B = 8;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const n = formSeries.length;
  const maxAbs = Math.max(...formSeries.map((v) => Math.abs(v)), 10);
  const x = (i) => PAD_L + (i / Math.max(n - 1, 1)) * plotW;
  const y = (v) => PAD_T + plotH / 2 - (v / maxAbs) * (plotH / 2);

  const areaPath = `M ${x(0)} ${y(0)} ` + formSeries.map((v, i) => `L ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') + ` L ${x(n - 1)} ${y(0)} Z`;
  const linePath = formSeries.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={PAD_L} y1={y(0)} x2={W - PAD_R} y2={y(0)} stroke="rgba(19,24,22,0.25)" strokeWidth="1" />
        <text x={PAD_L - 6} y={y(0) + 3.5} fontSize="9.5" fill={COLOR_TEXT} textAnchor="end">0</text>
        <text x={PAD_L - 6} y={y(maxAbs * 0.8) + 3.5} fontSize="9.5" fill={COLOR_TEXT} textAnchor="end">+{Math.round(maxAbs * 0.8)}</text>
        <text x={PAD_L - 6} y={y(-maxAbs * 0.8) + 3.5} fontSize="9.5" fill={COLOR_TEXT} textAnchor="end">−{Math.round(maxAbs * 0.8)}</text>
        <path d={areaPath} fill={COLOR_TSB} opacity="0.12" />
        <path d={linePath} fill="none" stroke={COLOR_TSB} strokeWidth="2" strokeLinejoin="round" />
        <text x={W - PAD_R + 4} y={y(formSeries[n - 1]) + 3.5} fontSize="10" fontWeight="700" fill={COLOR_TSB}>TSB</text>
      </svg>
      <p className="mt-1 text-xs text-ink/55">
        Form (TSB = fitness − fatigue). Below zero: building under fatigue. Above zero: freshening — where you want to be on race day.
      </p>
    </div>
  );
}

/** Weekly volume bars with value labels on hover. */
function WeeklyBars({ weeks }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...weeks.map((w) => w.load), 1);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {weeks.map((week, i) => (
          <div
            key={week.label}
            className="group relative flex-1"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && (
              <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-ink/10 bg-white px-2 py-1 text-[10px] shadow">
                <span className="font-semibold text-ink">{week.load.toFixed(0)}</span> <span className="text-ink/50">wk of {week.label}</span>
              </div>
            )}
            <div
              className="w-full rounded-t-[4px] transition"
              style={{
                height: `${Math.max(3, (week.load / max) * 112)}px`,
                background: hover === i ? COLOR_ATL : 'rgba(8,145,178,0.45)',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {weeks.map((week) => (
          <p key={week.label} className="flex-1 truncate text-center text-[9px] text-ink/45">{week.label}</p>
        ))}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const [activities, setActivities] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [activitiesRes, interventionsRes, settingsRes] = await Promise.all([
          fetch('/api/activities'),
          fetch('/api/interventions'),
          fetch('/api/settings'),
        ]);
        const activitiesData = activitiesRes.ok ? await activitiesRes.json() : { activities: [] };
        const interventionsData = interventionsRes.ok ? await interventionsRes.json() : { interventions: [] };
        const settingsData = settingsRes.ok ? await settingsRes.json() : { settings: {} };
        if (!active) return;
        setActivities(activitiesData.activities || []);
        setInterventions(interventionsData.interventions || []);
        setSettings(settingsData.settings || {});
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const loadMetrics = useMemo(() => getLoadMetrics(activities, settings), [activities, settings]);
  const { dailyLoad, acuteSeries, chronicSeries, formSeries, acute, chronic, form, status } = loadMetrics;

  const weeklyVolume = useMemo(() => {
    const blocks = [];
    for (let i = dailyLoad.length - 1; i >= 6; i -= 7) {
      const slice = dailyLoad.slice(i - 6, i + 1);
      blocks.unshift({
        label: slice[0].date.slice(5),
        load: slice.reduce((s, d) => s + d.load, 0),
      });
    }
    return blocks.slice(-10);
  }, [dailyLoad]);

  const rampRate = useMemo(() => {
    const recent = weeklyVolume.slice(-2);
    if (recent.length < 2 || recent[0].load <= 0) return 0;
    return ((recent[1].load - recent[0].load) / recent[0].load) * 100;
  }, [weeklyVolume]);

  const monotony = useMemo(() => {
    const last7 = dailyLoad.slice(-7).map((d) => d.load);
    if (!last7.length) return 0;
    const avg = last7.reduce((s, v) => s + v, 0) / last7.length;
    const variance = last7.reduce((s, v) => s + ((v - avg) ** 2), 0) / last7.length;
    const std = Math.sqrt(variance);
    return std > 0 ? avg / std : 0;
  }, [dailyLoad]);

  const compliance = useMemo(() => {
    const last28 = startOfDay(new Date());
    last28.setDate(last28.getDate() - 27);
    const activeDays = new Set(
      activities
        .filter((a) => a.start_date && new Date(a.start_date) >= last28)
        .map((a) => a.start_date.slice(0, 10))
    );
    return Math.round((activeDays.size / 28) * 100);
  }, [activities]);

  return (
    <main className="pb-20">
      <section className="ui-shell py-8">
        <NavMenu />
        <DashboardTabs activeHref="/progress" />
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-accent">Progress Lab</p>
            <h1 className="font-display mt-2 text-4xl text-ink">Training Progress</h1>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Fitness (CTL)', value: chronic, help: '42-day exponentially-weighted training load — your engine.', color: COLOR_CTL },
            { label: 'Fatigue (ATL)', value: acute, help: '7-day exponentially-weighted training load — recent stress.', color: COLOR_ATL },
            { label: 'Form (TSB)', value: form, help: 'Fitness minus fatigue. Negative = building, positive = fresh.', color: COLOR_TSB },
          ].map((m) => (
            <article key={m.label} className="rounded-[22px] border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: m.color }}>{m.label}</p>
              <p className="mt-2 text-3xl font-semibold text-ink" title={m.help}>{m.value.toFixed(1)}</p>
              <p className="mt-1 text-xs leading-4 text-ink/50">{m.help}</p>
            </article>
          ))}
          <article className={`rounded-[22px] border p-5 ${status.tone}`}>
            <p className="text-xs uppercase tracking-[0.18em]">Load status</p>
            <p className="mt-2 text-2xl font-semibold">{status.label}</p>
          </article>
        </div>

        <section className="mt-6 rounded-[28px] border border-ink/10 bg-white p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Fitness & fatigue — last 84 days</h2>
            <span className="text-xs text-ink/45">Hover for daily detail</span>
          </div>
          <div className="mt-3">
            <LoadChart dailyLoad={dailyLoad} acuteSeries={acuteSeries} chronicSeries={chronicSeries} formSeries={formSeries} />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-[28px] border border-ink/10 bg-white p-6">
            <h2 className="text-lg font-semibold text-ink">Form (TSB)</h2>
            <div className="mt-3">
              <FormChart formSeries={formSeries} />
            </div>
          </section>

          <section className="space-y-4">
            <article className="rounded-[24px] border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Consistency</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{compliance}%</p>
              <p className="mt-1 text-sm text-ink/65">Days with training in last 28 days.</p>
            </article>
            <article className="rounded-[24px] border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Interventions (30d)</p>
              <p className="mt-2 text-3xl font-semibold text-ink">
                {interventions.filter((i) => i.date && (new Date(i.date) >= new Date(Date.now() - 30 * 86400000))).length}
              </p>
              <p className="mt-1 text-sm text-ink/65">Recovery + fueling work logged this month.</p>
            </article>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-ink/10 bg-white p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Weekly training load</h2>
            <span className="text-xs text-ink/45">Sum of daily TRIMP per week</span>
          </div>
          <div className="mt-4">
            <WeeklyBars weeks={weeklyVolume} />
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-ink/10 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Ramp rate <span className="cursor-help text-ink/50" title="Week-over-week change in total load. Use to avoid aggressive spikes.">ⓘ</span></p>
            <p className="mt-2 text-3xl font-semibold text-ink">{rampRate.toFixed(1)}%</p>
          </article>
          <article className="rounded-[24px] border border-ink/10 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Monotony <span className="cursor-help text-ink/50" title="7-day mean load divided by 7-day standard deviation. Above ~2.0 with high load raises overtraining risk (Foster).">ⓘ</span></p>
            <p className="mt-2 text-3xl font-semibold text-ink">{monotony.toFixed(2)}</p>
          </article>
        </section>

        {loading ? <p className="mt-4 text-sm text-ink/55">Loading progress metrics…</p> : null}
      </section>
    </main>
  );
}
