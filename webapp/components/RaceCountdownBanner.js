import { useEffect, useState } from 'react';

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const race = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(race.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((race - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function urgencyClass(days) {
  if (days === null) return '';
  if (days <= 7) return 'bg-red-50 border-red-200 text-red-900';
  if (days <= 21) return 'bg-amber-50 border-amber-200 text-amber-900';
  return 'bg-paper border-ink/10 text-ink';
}

function urgencyDotClass(days) {
  if (days === null) return 'bg-ink/30';
  if (days <= 7) return 'bg-red-500';
  if (days <= 21) return 'bg-accent';
  return 'bg-accent';
}

function countdownLabel(days) {
  if (days === null) return '';
  if (days < 0) return 'Past';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day to go';
  return `${days} days to go`;
}

export default function RaceCountdownBanner() {
  const [race, setRace] = useState(null);
  const [showOutcomePrompt, setShowOutcomePrompt] = useState(false);

  useEffect(() => {
    function readRace() {
      try {
        const stored = window.localStorage.getItem('ultraos-default-race');
        if (!stored) { setRace(null); return; }
        const parsed = JSON.parse(stored);
        if (!parsed?.target_race || !parsed?.target_race_date) { setRace(null); return; }
        const days = getDaysUntil(parsed.target_race_date);

        // Race passed — check if outcome has been logged
        if (days !== null && days < 0) {
          const alreadyCaptured = window.localStorage.getItem('ultraos-recent-race-outcome');
          if (!alreadyCaptured) {
            setRace({ name: parsed.target_race, date: parsed.target_race_date, days });
            setShowOutcomePrompt(true);
          } else {
            setRace(null);
          }
          return;
        }

        setShowOutcomePrompt(false);
        setRace({ name: parsed.target_race, date: parsed.target_race_date, days });
      } catch {
        setRace(null);
      }
    }

    readRace();
    window.addEventListener('storage', readRace);
    return () => window.removeEventListener('storage', readRace);
  }, []);

  if (!race) return null;

  const { name, date, days } = race;

  // Post-race outcome prompt
  if (showOutcomePrompt) {
    return (
      <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-accent/30 bg-accent/8 px-4 py-3 lg:mx-0">
        <div className="flex items-center gap-3">
          <span className="text-base">🏅</span>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-ink">{name} is complete</span>
            <span className="ml-2 text-xs text-ink/50">Log your outcome to unlock race analysis</span>
          </div>
        </div>
        <a
          href="/race-outcome"
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper shadow-[0_2px_8px_rgba(19,24,22,0.18)] transition hover:opacity-90"
        >
          Log outcome →
        </a>
      </div>
    );
  }

  return (
    <div
      className={`mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border px-4 py-3 lg:mx-0 ${urgencyClass(days)}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${urgencyDotClass(days)}`} />
        <div className="min-w-0">
          <span className="text-sm font-semibold">{name}</span>
          {date ? (
            <span className="ml-2 text-xs opacity-60">
              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-data text-sm font-semibold tabular-nums">
          {countdownLabel(days)}
        </span>
        <a
          href="/log-intervention"
          className="rounded-full border border-current/20 bg-white/50 px-3 py-1.5 text-xs font-semibold opacity-80 transition hover:opacity-100"
        >
          Log prep
        </a>
      </div>
    </div>
  );
}
