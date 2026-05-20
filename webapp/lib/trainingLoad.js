export const loadStatusConfig = {
  balanced: { label: 'Balanced', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  productive: { label: 'Productive', tone: 'text-blue-700 bg-blue-50 border-blue-200' },
  overreaching: { label: 'Overreaching', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  detraining: { label: 'Detraining', tone: 'text-rose-700 bg-rose-50 border-rose-200' },
};

function getDateKey(date) { return date.toISOString().slice(0, 10); }
function startOfDay(dateLike) { const d = new Date(dateLike); d.setHours(0, 0, 0, 0); return d; }
function average(series) { return series.length ? series.reduce((s, v) => s + v, 0) / series.length : 0; }

export function buildDailyLoad(activities = [], days = 84) {
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

export function getLoadStatus(form) {
  if (form > 10) return 'detraining';
  if (form > 2) return 'balanced';
  if (form >= -8) return 'productive';
  return 'overreaching';
}

export function getLoadMetrics(activities = []) {
  const dailyLoad = buildDailyLoad(activities, 84);
  const acute = average(dailyLoad.slice(-7).map((d) => d.load));
  const chronic = average(dailyLoad.slice(-42).map((d) => d.load));
  const form = chronic - acute;
  const statusKey = getLoadStatus(form);
  return {
    dailyLoad,
    acute,
    chronic,
    form,
    statusKey,
    status: loadStatusConfig[statusKey],
  };
}

export function rollingAverageFromDailyLoad(dailyLoad = [], window = 7) {
  return dailyLoad.map((_, i, arr) => average(arr.slice(Math.max(0, i - (window - 1)), i + 1).map((d) => d.load)));
}
