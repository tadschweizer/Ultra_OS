import Link from 'next/link';
import { useEffect, useState } from 'react';
import EmptyStateCard from '../../components/EmptyStateCard';

export default function CoachAthletesPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [roster, setRoster] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/coach-roster');
        if (!response.ok) return;
        const data = await response.json();
        setProfile(data.profile || null);
        setRoster(data.roster || []);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <main className="ui-shell"><div className="ui-card text-sm text-ink/70">Loading athletes...</div></main>;
  }

  if (!profile) {
    return (
      <main className="ui-shell">
        <EmptyStateCard
          icon="network"
          title="Coach profile required"
          body="Finish coach setup before you start managing athletes."
          ctaLabel="Open Coach Setup"
          ctaHref="/coach/setup"
        />
      </main>
    );
  }

  return (
    <main className="ui-shell text-ink">
      <section className="ui-hero">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Athletes</p>
        <h1 className="font-display mt-4 text-4xl md:text-6xl">Your roster</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/68">
          Track who is connected, what they are training for, and who needs attention first.
        </p>
      </section>

      <section className="mt-6 ui-card overflow-x-auto">
        <table className="min-w-full text-left text-sm text-ink">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.18em] text-ink/50">
              <th className="pb-3 pr-4">Athlete</th>
              <th className="pb-3 pr-4">Race</th>
              <th className="pb-3 pr-4">Phase</th>
              <th className="pb-3 pr-4">Last Log</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {roster.length ? roster.map((item) => (
              <tr key={item.id} className="border-b border-ink/8 align-top">
                <td className="py-4 pr-4 font-semibold">
                  <Link href={`/coach/athletes/${item.athlete_id}`} className="text-ink hover:text-accent">
                    {item.athlete?.name || 'Athlete'}
                  </Link>
                </td>
                <td className="py-4 pr-4">{item.nextRace?.name || 'No race set'}</td>
                <td className="py-4 pr-4">{item.phase || 'Base'}</td>
                <td className="py-4 pr-4">{item.lastLogDate || 'No logs yet'}</td>
                <td className="py-4 pr-4">
                  <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/72">{item.status}</span>
                </td>
                <td className="py-4 text-ink/66">{item.reason}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="py-6 text-sm text-ink/66">No athletes are connected yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
