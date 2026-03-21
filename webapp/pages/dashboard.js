import { useEffect, useState } from 'react';

/**
 * Dashboard page showing a summary of the athlete's recent activities
 * and intervention count. Provides navigation to log a new intervention
 * and view history.
 */
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [activities, setActivities] = useState([]);
  const [interventionCount, setInterventionCount] = useState(0);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const me = await meRes.json();
          setAthlete(me.athlete);
          setInterventionCount(me.interventionCount);
          const settingsRes = await fetch('/api/settings');
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            setSettings(settingsData.settings);
          }
          const actRes = await fetch('/api/activities');
          if (actRes.ok) {
            const actData = await actRes.json();
            const sortedActivities = [...actData.activities].sort(
              (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
            );
            setActivities(sortedActivities);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <p className="p-4">Loading…</p>;
  if (!athlete) {
    return (
      <div className="p-4">
        <p>You are not logged in.</p>
        <a href="/" className="text-accent underline">
          Go to Home
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Hello, {athlete.name}</h1>
      <p className="mb-2">Recent Strava activities (last 7 days): {activities.length}</p>
      <p className="mb-4">Interventions logged: {interventionCount}</p>
      <div className="mb-6 flex flex-wrap gap-4">
        <a
          href="/log-intervention"
          className="bg-accent text-primary px-4 py-2 rounded-md font-semibold"
        >
          Log Intervention
        </a>
        <a
          href="/history"
          className="bg-accent text-primary px-4 py-2 rounded-md font-semibold"
        >
          View History
        </a>
        <a
          href="/settings"
          className="border border-secondary px-4 py-2 rounded-md font-semibold"
        >
          Athlete Settings
        </a>
      </div>
      <div className="mb-6 rounded-[26px] border border-white/10 bg-card/80 p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-accent">Baseline Context</p>
        {settings ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-slate-300">Sleep Altitude</p>
              <p className="font-semibold">{settings.baseline_sleep_altitude_ft ?? '-'} ft</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Training Altitude</p>
              <p className="font-semibold">{settings.baseline_training_altitude_ft ?? '-'} ft</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Resting HR</p>
              <p className="font-semibold">{settings.resting_hr ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Max HR</p>
              <p className="font-semibold">{settings.max_hr ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Carbs</p>
              <p className="font-semibold">{settings.normal_long_run_carb_g_per_hr ?? '-'} g/hr</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Sodium</p>
              <p className="font-semibold">{settings.sodium_target_mg_per_hr ?? '-'} mg/hr</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Sweat Rate</p>
              <p className="font-semibold">{settings.sweat_rate_l_per_hr ?? '-'} L/hr</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Sleep</p>
              <p className="font-semibold">{settings.typical_sleep_hours ?? '-'} hrs</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-300">
            Add your baseline altitude and heart-rate settings so intervention analysis has real context.
          </p>
        )}
      </div>
      <div className="grid gap-4">
        {activities.slice(0, 5).map((act) => (
          <div
            key={act.id}
            className="border border-secondary rounded-md p-3 bg-secondary/30"
          >
            <p className="font-semibold">{act.name}</p>
            <p className="text-sm">
              Date: {new Date(act.start_date).toLocaleString()}
            </p>
            <p className="text-sm">
              Distance: {(act.distance / 1609.34).toFixed(2)} mi
            </p>
            <p className="text-sm">
              Moving Time: {(act.moving_time / 60).toFixed(1)} min
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
