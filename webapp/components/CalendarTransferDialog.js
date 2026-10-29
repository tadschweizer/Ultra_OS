import { useRef, useState } from 'react';
import { useDialogFocus } from '../lib/useDialogFocus';

// Date movement has a non-drag path for touch and keyboard users. Matching is
// confirmed explicitly so a mistaken drop never overwrites recorded actuals.
export default function CalendarTransferDialog({ workout, activity, onSave, onClose }) {
  const [date, setDate] = useState(workout.workout_date);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const ref = useDialogFocus(onClose, busy);
  async function save(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const result = await onSave(activity ? { match_action: 'confirm', activity_id: activity.id } : { action: 'move', workout_date: date });
      if (result?.ok) onClose();
      else setError(result?.error || 'Change not confirmed. Refresh the calendar before retrying.');
    } catch { setError('Connection lost. Refresh the calendar before retrying.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4">
    <form ref={ref} role="dialog" aria-modal="true" aria-label={activity ? 'Confirm activity match' : 'Move workout'} onSubmit={save}
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-paper p-6 text-ink">
      <h2 className="text-xl font-semibold">{activity ? 'Confirm activity match' : 'Move workout'}</h2>
      <p className="mt-3 font-semibold break-words">{workout.title}</p>
      <p className="mt-1 text-sm">Planned for {workout.workout_date}</p>
      {activity ? <>
        <p className="mt-4 break-words">Match with <strong>{activity.name}</strong> · {activity.activity_date}</p>
        <p className="mt-2 text-sm">Uses this activity’s recorded duration and distance. The prescription and notes stay saved. It replaces this workout’s current completion.</p>
      </> : <>
        <label htmlFor="move-workout-date" className="mt-4 block text-sm font-semibold">Move to date</label>
        <input id="move-workout-date" type="date" required min="1900-01-01" max="2200-12-31" value={date} disabled={busy}
          onChange={event => setDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" />
        <p className="mt-2 text-sm">Moves this unfinished workout. Other sessions on that day stay in place.</p>
        <p className="mt-2 text-sm">Any unconfirmed activity suggestion is cleared. You can match an activity again afterward.</p>
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button disabled={busy || (!activity && (!date || date === workout.workout_date))} className="min-h-11 rounded-full bg-panel px-4 py-2 font-semibold text-paper disabled:opacity-50">{busy ? 'Saving…' : activity ? 'Confirm match' : 'Move workout'}</button>
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-full border border-ink/20 px-4 py-2 disabled:opacity-50">Cancel</button>
      </div>
    </form>
  </div>;
}
