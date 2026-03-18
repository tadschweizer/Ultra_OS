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

  useEffect(() => {
    async function fetchData() {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const me = await meRes.json();
          setAthlete(me.athlete);
          setInterventionCount(me.interventionCount);
          const actRes = await fetch('/api/activities');
          if (actRes.ok) {
            const actData = await actRes.json();
            setActivities(actData.activities);
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
