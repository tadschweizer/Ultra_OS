import { useEffect, useState } from 'react';

/**
 * Pending join requests from athletes who entered this coach's code.
 *
 * Entering a code used to add the athlete to the roster outright; it now
 * raises a request, and this is where the coach acts on it. The panel renders
 * nothing at all when there is nothing waiting, so it stays out of the way on
 * a normal day.
 */
export default function CoachRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/coach/connection-requests')
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((data) => {
        if (!cancelled) setRequests(data.requests || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(id, action) {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch('/api/coach/connection-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not update that request.');
      } else {
        setRequests((current) => current.filter((request) => request.id !== id));
      }
    } catch {
      setError('Could not update that request.');
    }
    setBusyId(null);
  }

  if (!requests.length) return null;

  return (
    <section className="mt-6 rounded-[30px] border border-accent/25 bg-accent/5 p-6">
      <p className="text-sm uppercase tracking-[0.25em] text-accent">
        Join Requests ({requests.length})
      </p>
      <p className="mt-3 text-sm leading-7 text-ink/76">
        These athletes entered your coach code. They will not appear on your roster, and you
        will not see their training, until you approve.
      </p>

      <div className="mt-5 space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4"
          >
            <div>
              <p className="text-sm font-semibold text-ink">
                {request.athlete?.name || 'Unnamed athlete'}
              </p>
              <p className="mt-1 text-xs text-ink/55">{request.athlete?.email || '—'}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => decide(request.id, 'approve')}
                disabled={busyId === request.id}
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide(request.id, 'decline')}
                disabled={busyId === request.id}
                className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>

      {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
