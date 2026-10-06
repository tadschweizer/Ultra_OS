import { acknowledgeMessages, mergeMessages, notifyMessagesChanged } from '../lib/messageClient';
import { useEffect, useMemo, useRef, useState } from 'react';
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

function conversationName(conversation, role) {
  if (role === 'athlete') return conversation?.athlete?.name || 'Coach';
  return conversation?.athlete?.name || conversation?.athlete?.email || 'Athlete';
}

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [templates, setTemplates] = useState({});
  const [templateKey, setTemplateKey] = useState('general_checkin');
  const [body, setBody] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [role, setRole] = useState('athlete');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const sendInFlight = useRef(false);
  const selectedRef = useRef('');
  const drafts = useRef({});
  const requestVersion = useRef(0);
  const requestPending = useRef(false);
  const requestAbort = useRef(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const retryId = useRef(null);
  const appliedTemplate = useRef(false);
  const loadRef = useRef(null);
  const historyLoaded = useRef(false);
  const requestedMode = router.query.mode === 'athlete' ? 'athlete' : 'coach';

  async function load(targetAthleteId = selectedRef.current, { keepSelection = false, older = false, background = false } = {}) {
    if (background && requestPending.current) return;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    requestPending.current = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    const version = ++requestVersion.current;
    try {
      const query = new URLSearchParams({ mode: requestedMode });
      if (targetAthleteId) query.set('athlete_id', targetAthleteId);
      if (older && nextCursor) query.set('before', nextCursor);
      const r = await fetch(`/api/coach/messages?${query.toString()}`, { signal: controller.signal });
      const d = await r.json();
      if (version !== requestVersion.current) return;
      if (!r.ok) { if (r.status === 403 || r.status === 401) { setMessages([]); setConversations([]); } throw new Error('Failed to load messages'); }
      setError((previous) => previous.startsWith('Unable to load') || previous.startsWith('Messages loaded') ? '' : previous);
      const nextConversations = d.conversations || [];
      setMessages((previous) => nextConversations.length && (older || historyLoaded.current) ? mergeMessages(previous, d.messages || []) : (d.messages || []));
      if (older || !historyLoaded.current) setNextCursor(d.next_cursor || null);
      if (older) historyLoaded.current = true;
      setConversations(nextConversations);
      setTemplates(d.templates || {});
      const requestedTemplate = typeof router.query.template_key === 'string' ? router.query.template_key : '';
      if (!appliedTemplate.current && requestedTemplate && d.templates?.[requestedTemplate] && !router.query.message_body) {
        appliedTemplate.current = true;
        setBody((draft) => draft || d.templates[requestedTemplate]);
      }
      setRole(d.role || 'athlete');

      if (!keepSelection && !targetAthleteId && d.role === 'coach' && nextConversations.length) {
        const firstAthleteId = nextConversations[0].athlete_id;
        selectedRef.current = firstAthleteId;
        setAthleteId(firstAthleteId);
        await load(firstAthleteId, { keepSelection: true });
      } else if (nextConversations.length) {
        const acknowledged = await acknowledgeMessages(d.messages || [], d.role, targetAthleteId || nextConversations[0].athlete_id);
        if (version === requestVersion.current) {
          if (!acknowledged) setError('Messages loaded, but read status could not be saved. We will retry.');
          else setConversations((items) => items.map((item) => item.athlete_id === (targetAthleteId || nextConversations[0].athlete_id) ? { ...item, unread_count: Math.max(0, item.unread_count - (d.messages || []).filter((m) => m.sender_role !== d.role && !m.read_at).length) } : item));
        }
      }
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError('Unable to load messages right now. Please try again.');
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion.current) { requestPending.current = false; setLoading(false); setLoadingOlder(false); }
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    const queryAthleteId = typeof router.query.athlete_id === 'string' ? router.query.athlete_id : '';
    const queryTemplateKey = typeof router.query.template_key === 'string' ? router.query.template_key : '';
    const queryBody = typeof router.query.message_body === 'string' ? router.query.message_body : '';

    if (queryTemplateKey) setTemplateKey(queryTemplateKey);
    if (queryBody) setBody(queryBody);

    if (queryAthleteId && selectedRef.current && queryAthleteId !== selectedRef.current) {
      selectConversation(queryAthleteId);
    } else if (queryAthleteId) {
      selectedRef.current = queryAthleteId;
      setAthleteId(queryAthleteId);
      load(queryAthleteId, { keepSelection: true });
    } else {
      load('');
    }
    return () => { requestVersion.current += 1; requestAbort.current?.abort(); };
  }, [router.isReady, router.query.athlete_id, requestedMode]);

  loadRef.current = load;
  useEffect(() => {
    if (!router.isReady) return;
    const refresh = () => { if (document.visibilityState !== 'hidden' && !sendInFlight.current && !loadingOlder) loadRef.current(selectedRef.current, { keepSelection: true, background: true }); };
    const timer = setInterval(refresh, 4000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); };
  }, [router.isReady, loadingOlder]);

  async function selectConversation(nextAthleteId) {
    if (sendInFlight.current) return;
    drafts.current[selectedRef.current] = { body, templateKey, retry: retryId.current };
    historyLoaded.current = false;
    selectedRef.current = nextAthleteId;
    setBody(drafts.current[nextAthleteId]?.body || '');
    setTemplateKey(drafts.current[nextAthleteId]?.templateKey || 'general_checkin');
    retryId.current = drafts.current[nextAthleteId]?.retry || null;
    setAthleteId(nextAthleteId);
    setMessages([]);
    setNextCursor(null);
    setLoading(true);
    setError('');
    await load(nextAthleteId, { keepSelection: true });
  }

  async function send(e) {
    e.preventDefault();
    if (sendInFlight.current || !canSend) return;
    sendInFlight.current = true;
    setSending(true);
    setError('');
    const signature = JSON.stringify([athleteId, body, templateKey]);
    if (retryId.current?.signature !== signature) retryId.current = { signature, id: crypto.randomUUID() };
    try {
      const r = await fetch('/api/coach/messages', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: requestedMode,
          client_message_id: retryId.current.id,
          athlete_id: role === 'coach' ? athleteId || undefined : undefined,
          template_key: role === 'coach' ? templateKey : undefined,
          message_body: body || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to send');
      setBody('');
      drafts.current[selectedRef.current] = { body: '', templateKey };
      retryId.current = null;
      notifyMessagesChanged();
      await load(athleteId, { keepSelection: true });
    } catch (err) {
      setError('Unable to send message. Please check required fields and retry.');
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  }

  const selectedTemplate = TEMPLATE_META[templateKey];
  const selectedConversation = useMemo(
    () => (athleteId ? conversations.find((conversation) => conversation.athlete_id === athleteId) : conversations[0]) || null,
    [athleteId, conversations]
  );
  const canSend = !loading && Boolean(body.trim()) && Boolean(selectedConversation) && (role === 'athlete' || Boolean(athleteId));

  return (
    <main className="min-h-screen bg-paper p-6 text-ink">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Coaching Loop</p>
          <h1 className="mt-2 text-3xl font-semibold">Messages</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
            Keep training questions and feedback in one place. Open conversations refresh automatically.
          </p>
        </header>

        {role === 'coach' && <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Not sure who needs a message?</p>
          <p className="mt-1 text-sm text-ink/65">
            The <a href="/coach-command-center" className="font-semibold text-accent hover:underline">Command Center triage feed</a> flags athletes with missed logs, compliance gaps, and upcoming races.
          </p>
        </div>}

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-ink/10 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Conversations</p>
              {role === 'coach' && <span className="rounded-full bg-paper px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink/50">Roster</span>}
            </div>

            {loading && !conversations.length ? <p className="mt-3 text-sm text-ink/60">Loading conversations…</p> : null}
            {!loading && !conversations.length ? (
              <p className="mt-3 rounded-xl border border-dashed border-ink/15 bg-paper p-3 text-sm text-ink/60">
                {role === 'coach' ? 'No active athletes found. Add athletes from the Command Center first.' : 'No active coach conversation found.'}
              </p>
            ) : null}

            <div className="mt-3 space-y-2">
              {conversations.map((conversation) => {
                const active = conversation.athlete_id === athleteId;
                return (
                  <button
                    key={conversation.athlete_id}
                    disabled={sending}
                    onClick={() => selectConversation(conversation.athlete_id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-accent/40 bg-accent/5' : 'border-ink/8 bg-paper hover:border-ink/20'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{conversationName(conversation, role)}</p>
                      {conversation.unread_count > 0 ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">{conversation.unread_count}</span>
                      ) : null}
                    </div>
                    {conversation.group_name ? <p className="mt-1 text-[11px] text-ink/45">Group: {conversation.group_name}</p> : null}
                    {conversation.last_message ? (
                      <p className="mt-1 line-clamp-2 text-xs text-ink/55">{conversation.last_message.message_body}</p>
                    ) : (
                      <p className="mt-1 text-xs text-ink/40">No messages yet.</p>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-4">
            <form onSubmit={send} className="space-y-3 rounded-2xl border border-ink/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Selected conversation</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{selectedConversation ? conversationName(selectedConversation, role) : 'Select a conversation'}</p>
                </div>
                {role === 'coach' && conversations.length ? (
                  <select
                    aria-label="Selected athlete"
                    disabled={sending}
                    value={athleteId}
                    onChange={(e) => selectConversation(e.target.value)}
                    className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm"
                  >
                    {conversations.map((conversation) => (
                      <option key={conversation.athlete_id} value={conversation.athlete_id}>{conversationName(conversation, role)}</option>
                    ))}
                  </select>
                ) : null}
              </div>

              {role === 'coach' ? (
                <div>
                  <label htmlFor="message-purpose" className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">Message purpose</label>
                  <select
                    id="message-purpose"
                    disabled={sending}
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
              ) : null}

              <label htmlFor="message-body" className="block text-sm font-semibold text-ink">Your message</label>
              <textarea
                id="message-body"
                disabled={sending}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
                rows={3}
                className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm"
                placeholder="Type message"
              />
              <button disabled={sending || !canSend} className="rounded-full bg-panel px-5 py-2.5 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-60">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>

            <section className="rounded-2xl border border-ink/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Conversation</p>
              {loading && <p className="mt-3 text-sm text-ink/60">Loading messages…</p>}
              {!!error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
              {!loading && !messages.length && (
                <p className="mt-3 text-sm text-ink/60">No messages yet. Start the loop with a check-in.</p>
              )}
              {nextCursor && <button disabled={loadingOlder} onClick={() => { setLoadingOlder(true); load(athleteId, { keepSelection: true, older: true }); }} className="mt-3 rounded-full border border-ink/20 px-4 py-2 text-sm">{loadingOlder ? 'Loading…' : 'Load older messages'}</button>}
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
          </section>
        </div>
      </div>
    </main>
  );
}
