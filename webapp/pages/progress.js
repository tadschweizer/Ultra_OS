import { useEffect, useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';

const loadStatusConfig = {
  balanced: { label: 'Balanced', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  productive: { label: 'Productive', tone: 'text-blue-700 bg-blue-50 border-blue-200' },
  overreaching: { label: 'Overreaching', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  detraining: { label: 'Detraining', tone: 'text-rose-700 bg-rose-50 border-rose-200' },
};

function getDateKey(date) { return date.toISOString().slice(0, 10); }
function startOfDay(dateLike) { const d = new Date(dateLike); d.setHours(0, 0, 0, 0); return d; }

function buildDailyLoad(activities = [], days = 84) {
  const today = startOfDay(new Date());
  const byDay = new Map();
  activities.forEach((activity) => {
    if (!activity?.start_date) return;
    const dayKey = activity.start_date.slice(0, 10);
    const trimp = (Number(activity.moving_time || 0) / 60) * (Number(activity.average_heartrate || 130) / 140);
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + trimp);
  });

  return Array.from({ length: days }).map((_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - idx - 1));
    const key = getDateKey(date);
    return { date: key, load: Number((byDay.get(key) || 0).toFixed(1)) };
  });
}

function average(series) { return series.length ? series.reduce((s, v) => s + v, 0) / series.length : 0; }

function getLoadStatus(form) {
  if (form > 10) return 'detraining';
  if (form > 2) return 'balanced';
  if (form >= -8) return 'productive';
  return 'overreaching';
}

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

  const dailyLoad = useMemo(() => buildDailyLoad(activities, 84), [activities]);
  const acute = useMemo(() => average(dailyLoad.slice(-7).map((d) => d.load)), [dailyLoad]);
  const chronic = useMemo(() => average(dailyLoad.slice(-42).map((d) => d.load)), [dailyLoad]);
  const form = useMemo(() => chronic - acute, [acute, chronic]);
  const statusKey = getLoadStatus(form);
  const status = loadStatusConfig[statusKey];

  const loadValues = dailyLoad.map((d) => d.load);
  const maxLoad = Math.max(...loadValues, 1);
  const acuteLine = dailyLoad.map((_, i, arr) => average(arr.slice(Math.max(0, i - 6), i + 1).map((d) => d.load)));
  const chronicLine = dailyLoad.map((_, i, arr) => average(arr.slice(Math.max(0, i - 41), i + 1).map((d) => d.load)));

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
              <path d={toPath(loadValues, 640, 260, maxLoad)} fill="none" stroke="#D4B06A" strokeWidth="2" opacity="0.35" />
              <path d={toPath(acuteLine, 640, 260, maxLoad)} fill="none" stroke="#1f7a8c" strokeWidth="3" />
              <path d={toPath(chronicLine, 640, 260, maxLoad)} fill="none" stroke="#131816" strokeWidth="3" opacity="0.7" />
            </svg>
            <p className="mt-3 text-sm text-ink/65">Blue = 7-day acute load · Charcoal = 42-day chronic load.</p>
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

        {loading ? <p className="mt-4 text-sm text-ink/55">Loading progress metrics…</p> : null}
      </section>
    </main>
  );
}
