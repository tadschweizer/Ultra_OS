import { useState } from 'react';
import { useDialogFocus } from '../lib/useDialogFocus';

function weekStart(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CopyWeekDialog({ source, defaultDestination, storageKey, onCopy, onClose }) {
  const [destination, setDestination] = useState(() => {
    try { return weekStart(sessionStorage.getItem(storageKey)) || defaultDestination; } catch { return defaultDestination; }
  });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useDialogFocus(onClose, busy);
  async function submit(event) {
    event.preventDefault();
    if (busy || !destination || destination === source || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      if (!await onCopy(destination)) setError('Copy was not confirmed. Your selected week is saved; retry to check and finish the same copy.');
    } catch { setError('Connection lost. Retry to check and finish the same copy.'); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="copy-week-title" className="max-h-[90dvh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-xl">
      <h2 id="copy-week-title" className="text-lg font-semibold">Copy week</h2>
      <p className="mt-2 text-sm">Copy workouts from the week starting {source} for this athlete. Days, instructions and targets stay the same. Results and feedback are not copied.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-sm font-semibold">Destination week
          <input type="date" required disabled={busy} value={destination} onChange={event => {
            const next = weekStart(event.target.value);
            setDestination(next); setConfirmed(false); setError('');
            try { sessionStorage.setItem(storageKey, next); } catch {}
          }} className="mt-1 block min-h-11 w-full rounded-lg border border-ink/20 p-2" />
        </label>
        <p className="text-sm">Choose any date; the week starts on Monday{destination ? `, ${destination}` : ''}.</p>
        {destination === source && <p role="alert">Choose a different destination week.</p>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />Add these workouts even if the destination already has sessions. Keep all existing workouts.</label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-full border px-4">Cancel</button>
          <button type="submit" disabled={busy || !confirmed || !destination || destination === source} className="min-h-11 rounded-full bg-ink px-4 text-white disabled:opacity-40">{busy ? 'Copying…' : 'Copy workouts'}</button>
        </div>
      </form>
    </section>
  </div>;
}
