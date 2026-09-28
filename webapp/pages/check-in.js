import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchMe, getCachedMe } from '../lib/meClient';
import { CHECK_IN_TYPE, hasCheckedInOn, localDateString } from '../lib/checkIn';

const SCORES = [
  { key: 'legs_feel', label: 'Legs', low: 'Dead', high: 'Fresh' },
  { key: 'energy_feel', label: 'Energy', low: 'Wiped', high: 'Great' },
  { key: 'perceived_effort', label: 'Effort (RPE)', low: 'Easy', high: 'All-out' },
];

function ScoreRow({ score, value, onChange }) {
  return (
    <fieldset className="rounded-2xl border border-ink/10 bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-ink">{score.label}</legend>
      <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${score.label} ${n} of 10`}
            onClick={() => onChange(n)}
            className={`h-12 rounded-xl text-base font-semibold transition ${value === n ? 'bg-ink text-paper' : 'border border-ink/15 bg-paper text-ink'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink/60">
        <span>1 = {score.low}</span>
        <span>10 = {score.high}</span>
      </div>
    </fieldset>
  );
}

export default function CheckInPage() {
  const [today] = useState(() => localDateString());
  const [date, setDate] = useState(today);
  const [values, setValues] = useState({ legs_feel: null, energy_feel: null, perceived_effort: null });
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [lastCheckInDate, setLastCheckInDate] = useState(() => getCachedMe()?.lastCheckInDate || null);
  const [gate, setGate] = useState(() => getCachedMe()?.checkInGate || null);
  const submitting = useRef(false);

  useEffect(() => {
    fetchMe({ force: true }).then((me) => {
      setLastCheckInDate(me?.lastCheckInDate || null);
      setGate(me?.checkInGate || null);
    }).catch(() => {});
  }, []);

  const complete = useMemo(() => SCORES.every((s) => values[s.key] !== null), [values]);
  const blocked = gate?.allowed === false;
  const alreadyDone = hasCheckedInOn(lastCheckInDate, date);

  const submit = async (event) => {
    event.preventDefault();
    if (!complete || blocked || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setStatus({ kind: '', text: '' });
    try {
      const res = await fetch('/api/log-intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervention_type: CHECK_IN_TYPE,
          checkin_fast: true,
          date,
          notes: notes.trim() || null,
          protocol_payload: {
            legs_feel: values.legs_feel,
            energy_feel: values.energy_feel,
            perceived_effort: values.perceived_effort,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: 'error', text: data.error || 'Check-in could not be saved. Your answers are still here; try again.' });
        return;
      }
      setLastCheckInDate(date);
      setValues({ legs_feel: null, energy_feel: null, perceived_effort: null });
      setNotes('');
      fetchMe({ force: true }).then((me) => setGate(me?.checkInGate || null)).catch(() => {});
      setStatus({ kind: 'success', text: 'Check-in saved. Thanks — your coach can see it.' });
    } catch {
      setStatus({ kind: 'error', text: 'Network problem. Your answers are still here; try again.' });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper px-4 pb-28 pt-6 text-ink">
      <div className="mx-auto max-w-xl">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Daily check-in</p>
        <h1 className="font-display mt-2 text-4xl leading-tight">How did today feel?</h1>
        <p className="mt-2 text-sm text-ink/70">Three taps and you are done. It takes about 30 seconds.</p>

        {blocked ? (
          <div role="status" className="mt-4 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/80">
            <p>{gate.reason || 'Check-ins are not available on your current plan.'}</p>
            <Link href="/pricing" className="mt-2 inline-block font-semibold text-ink underline">See plans</Link>
          </div>
        ) : null}

        {alreadyDone && !blocked ? (
          <p role="status" className="mt-4 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/80">
            You already checked in for this date. You can add another if something changed.
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-5 grid gap-4" aria-disabled={blocked}>
          <fieldset disabled={blocked || busy} className="contents">
          <label className="block text-sm font-semibold text-ink">
            Date
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
              className="mt-1 block h-12 w-full rounded-xl border border-ink/15 bg-white px-3 text-base font-normal"
            />
          </label>

          {SCORES.map((score) => (
            <ScoreRow
              key={score.key}
              score={score}
              value={values[score.key]}
              onChange={(n) => setValues((current) => ({ ...current, [score.key]: n }))}
            />
          ))}

          <label className="block text-sm font-semibold text-ink">
            Note for your coach (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-base font-normal"
            />
          </label>

          {status.text ? (
            <p
              role={status.kind === 'error' ? 'alert' : 'status'}
              className={`rounded-2xl border px-4 py-3 text-sm ${status.kind === 'error' ? 'border-red-300 bg-red-50 text-red-800' : 'border-accent/30 bg-accent/10 text-ink'}`}
            >
              {status.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!complete || busy || blocked}
            className="h-14 rounded-full bg-ink text-base font-semibold text-paper disabled:opacity-40"
          >
            {busy ? 'Saving…' : complete ? 'Save check-in' : 'Pick all three to save'}
          </button>
          </fieldset>
          <Link href="/log-intervention" className="text-center text-sm text-ink/60 underline">
            Need to log a session or intervention instead?
          </Link>
        </form>
      </div>
    </main>
  );
}
