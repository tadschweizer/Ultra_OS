import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import {
  getLoadMetrics,
  rollingAverageFromDailyLoad,
} from '../lib/trainingLoad';
function startOfDay(dateLike) { const d = new Date(dateLike); d.setHours(0, 0, 0, 0); return d; }

function toPath(points, width, height, maxValue) {
  if (!points.length) return '';
  return points.map((value, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const y = height - (value / Math.max(maxValue, 1)) * height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

export default function ProgressPage() {
  const [activities, setActivities] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [activitiesRes, interventionsRes] = await Promise.all([
          fetch('/api/activities'),
          fetch('/api/interventions'),
        ]);
        const activitiesData = activitiesRes.ok ? await activitiesRes.json() : { activities: [] };
        const interventionsData = interventionsRes.ok ? await interventionsRes.json() : { interventions: [] };
        if (!active) return;
        setActivities(activitiesData.activities || []);
        setInterventions(interventionsData.interventions || []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const loadMetrics = useMemo(() => getLoadMetrics(activities), [activities]);
  const { dailyLoad, acute, chronic, form, status } = loadMetrics;

  const loadValues = dailyLoad.map((d) => d.load);
  const maxLoad = Math.max(...loadValues, 1);
  const acuteLine = useMemo(() => rollingAverageFromDailyLoad(dailyLoad, 7), [dailyLoad]);
  const chronicLine = useMemo(() => rollingAverageFromDailyLoad(dailyLoad, 42), [dailyLoad]);

  const weeklyVolume = useMemo(() => {
    const blocks = [];
    for (let i = dailyLoad.length - 1; i >= 6; i -= 7) {
      const slice = dailyLoad.slice(i - 6, i + 1);
      blocks.unshift({
        label: slice[0].date.slice(5),
        load: slice.reduce((s, d) => s + d.load, 0),
      });
    }
    return blocks.slice(-8);
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
            { label: 'Acute', value: acute },
            { label: 'Chronic', value: chronic },
            { label: 'Form', value: form },
          ].map((m) => (
            <article key={m.label} className="rounded-[22px] border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">{m.label}</p>
              <p className="mt-1 text-xs text-ink/50" title={m.label === 'Acute' ? '7-day average training load.' : m.label === 'Chronic' ? '42-day average training load.' : 'Chronic minus acute load: positive means fresher, negative means more fatigue.'}>ⓘ hover for definition</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{m.value.toFixed(1)}</p>
            </article>
          ))}
          <article className={`rounded-[22px] border p-5 ${status.tone}`}>
            <p className="text-xs uppercase tracking-[0.18em]">Load status</p>
            <p className="mt-2 text-3xl font-semibold">{status.label}</p>
          </article>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-[28px] border border-ink/10 bg-white p-6">
            <h2 className="text-lg font-semibold text-ink">Load trend (84 days)</h2>
            <svg viewBox="0 0 640 260" className="mt-4 w-full overflow-visible">
              <line x1="0" y1="259" x2="640" y2="259" stroke="#131816" strokeOpacity="0.2" />
              <line x1="1" y1="0" x2="1" y2="260" stroke="#131816" strokeOpacity="0.2" />
              <path d={toPath(loadValues, 640, 260, maxLoad)} fill="none" stroke="#D4B06A" strokeWidth="2" opacity="0.35" />
              <path d={toPath(acuteLine, 640, 260, maxLoad)} fill="none" stroke="#1f7a8c" strokeWidth="3" />
              <path d={toPath(chronicLine, 640, 260, maxLoad)} fill="none" stroke="#131816" strokeWidth="3" opacity="0.7" />
              <text x="4" y="16" fontSize="11" fill="#131816" fillOpacity="0.65">Load (TRIMP)</text>
              <text x="540" y="252" fontSize="11" fill="#131816" fillOpacity="0.65">Time (84 days)</text>
            </svg>
            <p className="mt-3 text-sm text-ink/65">Blue = 7-day acute load · Charcoal = 42-day chronic load. Higher values mean more recent training stress.</p>
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
          <h2 className="text-lg font-semibold text-ink">Weekly load tracker</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {weeklyVolume.map((week) => (
              <div key={week.label} className="rounded-[18px] bg-paper px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-ink/55">Week of {week.label}</p>
                <p className="mt-2 text-xl font-semibold text-ink">{week.load.toFixed(0)}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-ink/10 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Ramp rate <span className="cursor-help text-ink/50" title="Week-over-week change in total load. Use to avoid aggressive spikes.">ⓘ</span></p>
            <p className="mt-2 text-3xl font-semibold text-ink">{rampRate.toFixed(1)}%</p>
          </article>
          <article className="rounded-[24px] border border-ink/10 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Monotony <span className="cursor-help text-ink/50" title="7-day mean load divided by 7-day standard deviation. Higher means less day-to-day variation.">ⓘ</span></p>
            <p className="mt-2 text-3xl font-semibold text-ink">{monotony.toFixed(2)}</p>
          </article>
        </section>

        {loading ? <p className="mt-4 text-sm text-ink/55">Loading progress metrics…</p> : null}
      </section>
    </main>
  );
}
