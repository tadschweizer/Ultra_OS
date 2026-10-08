import { useEffect, useState } from 'react';
import { localDateString } from '../lib/checkIn';

export default function TodayTraining() {
  const [state, setState] = useState({ loading: true, workouts: [], reply: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const day = localDateString();
    async function load() {
      try {
        const [planned, inbox] = await Promise.all([
          fetch(`/api/planned-workouts?start=${day}&end=${day}`, { signal: controller.signal }),
          fetch('/api/coach/messages?mode=athlete', { signal: controller.signal }),
        ]);
        if (!planned.ok) throw new Error('Could not load today’s training.');
        const data = await planned.json();
        const messages = inbox.ok ? await inbox.json() : null;
        if (!controller.signal.aborted) setState({ loading: false, workouts: data.workouts || [],
          reply: messages?.messages?.filter((m) => m.sender_role === 'coach').at(-1), messageError: !inbox.ok });
      } catch {
        if (!controller.signal.aborted) setState({ loading: false, workouts: [], error: true });
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);
  return (
    <section aria-label="Today's training" className="mb-6 rounded-[24px] border border-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Today</h2>
        <a href="/calendar?log=1" className="rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper">Log workout</a>
      </div>
      {state.loading ? <p className="mt-3 text-sm text-ink/60">Loading today’s training…</p> : state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">Could not load today’s training. <button className="underline" onClick={() => setAttempt((n) => n + 1)}>Retry</button></p>
      ) : state.workouts.length ? (
        <ul className="mt-3 space-y-2">{state.workouts.map((workout) => <li key={workout.id}>
          <a href={`/calendar?workout=${encodeURIComponent(workout.id)}`} className="block rounded-xl border border-ink/10 p-3 hover:bg-paper">
            <span className="font-semibold">{workout.title}</span>
            <span className="mt-1 block text-sm text-ink/60">{workout.sport} · {workout.status}{workout.planned_duration_min ? ` · ${workout.planned_duration_min} min planned` : ''}</span>
          </a>
        </li>)}</ul>
      ) : <p className="mt-3 text-sm text-ink/60">No workout planned today. You can still log a session or <a href="/calendar" className="underline">view your calendar</a>.</p>}
      {state.reply && <a href="/messages?mode=athlete" className="mt-4 block border-t border-ink/10 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">Latest coach reply</span>
        <p className="mt-1 line-clamp-2 text-sm text-ink/75">{state.reply.message_body}</p>
      </a>}
      {state.messageError && <p className="mt-3 text-sm text-ink/60">Coach replies could not be loaded. <a href="/messages" className="underline">Open Messages</a></p>}
    </section>
  );
}
