import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const TEMPLATE_META = {
  missed_protocol_reminder: {
    label: 'Missed protocol reminder',
    context: 'Nudge an athlete who has fallen behind on an assigned protocol.',
  },
  race_week_checkin: {
    label: 'Race-week check-in',
    context: 'Confirm readiness, logistics, and final prep before race day.',
  },
  gut_training_reminder: {
    label: 'Gut training reminder',
    context: 'Keep fueling work on schedule during a gut training block.',
  },
  heat_block_reminder: {
    label: 'Heat block reminder',
    context: 'Keep heat acclimation sessions on track and logged.',
  },
  post_race_debrief_prompt: {
    label: 'Post-race debrief prompt',
    context: 'Capture race outcomes while they are fresh — feeds the next cycle.',
  },
  general_checkin: {
    label: 'General check-in',
    context: 'Open-ended check on how the athlete is doing this week.',
  },
};

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState({});
  const [templateKey, setTemplateKey] = useState('general_checkin');
  const [body, setBody] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function load(targetAthleteId = athleteId) {
    setError('');
    try {
      const r = await fetch('/api/coach/messages' + (targetAthleteId ? `?athlete_id=${targetAthleteId}` : ''));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load messages');
      setMessages(d.messages || []);
      setTemplates(d.templates || {});
    } catch (err) {
      setError('Unable to load messages right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    const queryAthleteId = typeof router.query.athlete_id === 'string' ? router.query.athlete_id : '';
    if (queryAthleteId) {
      setAthleteId(queryAthleteId);
      load(queryAthleteId);
    } else {
      load('');
    }
  }, [router.isReady]);

  async function send(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const r = await fetch('/api/coach/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ athlete_id: athleteId || undefined, template_key: templateKey, message_body: body || undefined }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to send');
      setBody('');
      await load();
    } catch (err) {
      setError('Unable to send message. Please check required fields and retry.');
    } finally {
      setSending(false);
    }
  }

  const selectedTemplate = TEMPLATE_META[templateKey];

  return (
    <main className="min-h-screen bg-paper p-6 text-ink">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Coaching Loop</p>
          <h1 className="mt-2 text-3xl font-semibold">Messages</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">
            Every message here is part of a coaching decision — protocol reminders, race-week check-ins, and debrief prompts live next to the data they refer to.
          </p>
        </header>

        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Not sure who needs a message?</p>
          <p className="mt-1 text-sm text-ink/65">
            The <a href="/coach-command-center" className="font-semibold text-accent hover:underline">Command Center triage feed</a> flags athletes with missed logs, compliance gaps, and upcoming races.
          </p>
        </div>

        <form onSubmit={send} className="space-y-3 rounded-2xl border border-ink/10 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Athlete</label>
            <input
              placeholder="Athlete ID (coaches only — athletes message their coach directly)"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Message purpose</label>
            <select
              value={templateKey}
              onChange={(e) => { setTemplateKey(e.target.value); setBody(templates[e.target.value] || ''); }}
              className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm"
            >
              {Object.keys(templates).map((k) => (
                <option key={k} value={k}>{TEMPLATE_META[k]?.label || k}</option>
              ))}
            </select>
            {selectedTemplate ? (
              <p className="mt-1.5 text-xs text-ink/50">{selectedTemplate.context}</p>
            ) : null}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm"
            placeholder="Type message"
          />
          <button disabled={sending} className="rounded-full bg-panel px-5 py-2.5 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>

        <section className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Conversation</p>
          {loading && <p className="mt-3 text-sm text-ink/60">Loading messages…</p>}
          {!!error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          {!loading && !messages.length && (
            <p className="mt-3 text-sm text-ink/60">No messages yet. Start the loop with a check-in.</p>
          )}
          <div className="mt-3 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border p-3 ${
                  m.sender_role === 'coach' ? 'border-accent/20 bg-accent/5' : 'border-ink/8 bg-paper'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      m.sender_role === 'coach' ? 'bg-accent/15 text-accent' : 'bg-ink/8 text-ink/60'
                    }`}
                  >
                    {m.sender_role}
                  </span>
                  <span className="text-xs text-ink/40">{formatTimestamp(m.created_at)}</span>
                </div>
                {m.message_template_key && TEMPLATE_META[m.message_template_key] ? (
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                    {TEMPLATE_META[m.message_template_key].label}
                  </p>
                ) : null}
                <p className="mt-1.5 text-sm leading-6 text-ink/80">{m.message_body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
