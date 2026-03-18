import { useEffect, useState } from 'react';

/**
 * Home page with a hero section and a call to action.
 *
 * If the athlete is already logged in (determined by a client‑side
 * cookie), show a link to the dashboard. Otherwise show a button to
 * initiate Strava login.
 */
export default function Home() {
  const [athleteId, setAthleteId] = useState(null);
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/athlete_id=([^;]+)/);
      if (match) {
        setAthleteId(match[1]);
      }
    }
  }, []);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-3xl">
        Performance intelligence for athletes who go long
      </h1>
      <p className="mb-8 max-w-2xl text-lg">
        TrainingPeaks logs your workouts. UltraOS tells you what's actually
        working.
      </p>
      {athleteId ? (
        <a
          href="/dashboard"
          className="bg-accent text-primary px-6 py-3 rounded-md font-semibold"
        >
          Go to Dashboard
        </a>
      ) : (
        <a
          href="/api/strava/login"
          className="bg-accent text-primary px-6 py-3 rounded-md font-semibold"
        >
          Login with Strava
        </a>
      )}
    </main>
  );
}
