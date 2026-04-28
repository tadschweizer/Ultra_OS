import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ConversationBubble({ message }) {
  const coachMessage = message.sender_role === 'coach';

  return (
    <div className={`flex ${coachMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm ${coachMessage ? 'bg-amber-200 text-ink' : 'border border-border-subtle bg-white text-ink'}`}>
        {message.context ? (
          message.context.href ? (
            <Link href={message.context.href} className="mb-3 block rounded-[16px] bg-black/5 px-3 py-2 text-xs text-ink/70 transition hover:bg-black/10">
              <p className="font-semibold text-ink/78">{message.context.title}</p>
              <p className="mt-1">{message.context.subtitle}</p>
            </Link>
          ) : (
            <div className="mb-3 rounded-[16px] bg-black/5 px-3 py-2 text-xs text-ink/70">
              <p className="font-semibold text-ink/78">{message.context.title}</p>
              <p className="mt-1">{message.context.subtitle}</p>
            </div>
          )
        ) : null}

        <p className="text-sm leading-6">{message.content}</p>
        <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink/45">{formatTimestamp(message.created_at)}</p>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const router = useRouter();
  const participantFromQuery = typeof router.query.participant === 'string' ? router.query.participant : '';
  const [threads, setThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [participant, setParticipant] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState(participantFromQuery);
  const [draft, setDraft] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const touchStartX = useRef(null);

  useEffect(() => {
    setSelectedParticipantId(participantFromQuery);
  }, [participantFromQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadThreads() {
      setLoadingThreads(true);
      try {
        const response = await fetch('/api/messages');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load messages.');
        if (cancelled) return;

        setThreads(data.threads || []);
        setContacts(data.contacts || []);
        setError('');

        if (!selectedParticipantId) {
          const firstThread = data.threads?.[0]?.participant?.athleteId || data.contacts?.[0]?.athleteId || '';
          if (firstThread) {
            setSelectedParticipantId(firstThread);
            router.replace(`/messages?participant=${firstThread}`, undefined, { shallow: true });
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    }

    loadThreads();
    return () => {
      cancelled = true;
    };
  }, [router, selectedParticipantId]);

  useEffect(() => {
    if (!selectedParticipantId) return;
    let cancelled = false;

    async function loadConversation() {
      setLoadingConversation(true);
      try {
        const response = await fetch(`/api/messages?participant=${selectedParticipantId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load conversation.');
        if (cancelled) return;

        setParticipant(data.participant || null);
        setMessages(data.messages || []);
        setContacts(data.contacts || []);
        setError('');
        setThreads((current) => current.map((thread) => (
          thread.participant?.athleteId === selectedParticipantId
            ? { ...thread, unreadCount: 0 }
            : thread
        )));

        await fetch('/api/messages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participant_athlete_id: selectedParticipantId }),
        });
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoadingConversation(false);
      }
    }

    loadConversation();
    return () => {
      cancelled = true;
    };
  }, [selectedParticipantId]);

  const threadMap = useMemo(
    () => new Map(threads.map((thread) => [thread.participant?.athleteId, thread])),
    [threads]
  );

  async function handleSend(event) {
    event.preventDefault();
    if (!selectedParticipantId || !draft.trim()) return;

    setSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_athlete_id: selectedParticipantId,
          content: draft.trim(),
          context_type: 'general',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send message.');

      setDraft('');
      setMessages((current) => [...current, data.message]);

      const thread = threadMap.get(selectedParticipantId);
      const participantContact = participant || contacts.find((contact) => contact.athleteId === selectedParticipantId) || null;
      setThreads((current) => {
        const remaining = current.filter((item) => item.participant?.athleteId !== selectedParticipantId);
        return [{
          participant: participantContact,
          lastMessage: data.message,
          unreadCount: thread?.unreadCount || 0,
        }, ...remaining];
      });
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  }

  function returnToThreadList() {
    setSelectedParticipantId('');
    setParticipant(null);
    router.replace('/messages', undefined, { shallow: true });
  }

  const showThreadListOnly = !selectedParticipantId;

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[36px] border border-ink/10 bg-[linear-gradient(145deg,#f5ede2_0%,#e4d5c0_52%,#d2b48a_100%)] p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accent">Messages</p>
              <h1 className="font-display mt-4 text-5xl leading-tight md:text-6xl">Coach-athlete conversations</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/68">
                Messaging stays tied to interventions, protocol progress, and race preparation instead of floating outside the work.
              </p>
            </div>
            {participant ? (
              <div className="rounded-[24px] bg-white/70 px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Open thread</p>
                <p className="mt-2 text-lg font-semibold text-ink">{participant.displayName}</p>
                <p className="mt-1 text-sm text-ink/58">{participant.subtitle}</p>
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-[32px] border border-ink/10 bg-white shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <div className="grid min-h-[70vh] lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className={`${showThreadListOnly ? 'block' : 'hidden'} border-r border-ink/10 lg:block`}>
              <div className="border-b border-ink/8 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-accent">Inbox</p>
                <p className="mt-2 text-sm text-ink/58">Threads grouped by person.</p>
              </div>

              <div className="max-h-[70vh] overflow-y-auto">
                {loadingThreads ? (
                  <p className="px-5 py-6 text-sm text-ink/58">Loading threads…</p>
                ) : contacts.length ? contacts.map((contact) => {
                  const thread = threadMap.get(contact.athleteId);
                  const active = selectedParticipantId === contact.athleteId;
                  return (
                    <button
                      key={contact.athleteId}
                      type="button"
                      onClick={() => {
                        setSelectedParticipantId(contact.athleteId);
                        router.replace(`/messages?participant=${contact.athleteId}`, undefined, { shallow: true });
                      }}
                      className={`flex w-full items-start gap-3 border-b border-ink/6 px-5 py-4 text-left transition ${active ? 'bg-paper' : 'hover:bg-paper/60'}`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-panel text-sm font-semibold text-paper">
                        {contact.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{contact.displayName}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/42">{contact.subtitle}</p>
                          </div>
                          <p className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-ink/40">
                            {formatTimestamp(thread?.lastMessage?.created_at)}
                          </p>
                        </div>
                        <p className="mt-2 truncate text-sm text-ink/58">
                          {thread?.lastMessage?.preview || 'Start the conversation.'}
                        </p>
                      </div>
                      {thread?.unreadCount ? (
                        <span className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white">
                          {thread.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  );
                }) : (
                  <p className="px-5 py-8 text-sm text-ink/58">No coach-athlete relationships are ready for messaging yet.</p>
                )}
              </div>
            </aside>

            <div className={`${showThreadListOnly ? 'hidden' : 'flex'} min-h-[70vh] flex-col lg:flex`}>
              <div className="flex items-center justify-between border-b border-ink/8 px-5 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={returnToThreadList}
                    className="rounded-full border border-ink/10 px-3 py-2 text-sm font-semibold text-ink lg:hidden"
                  >
                    Back
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-ink">{participant?.displayName || 'Conversation'}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/42">{participant?.subtitle || 'Select a thread'}</p>
                  </div>
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#faf7f2_0%,#f4ede3_100%)] px-4 py-5"
                onTouchStart={(event) => {
                  touchStartX.current = event.changedTouches?.[0]?.clientX || null;
                }}
                onTouchEnd={(event) => {
                  const endX = event.changedTouches?.[0]?.clientX || null;
                  if (touchStartX.current !== null && endX !== null && endX - touchStartX.current > 70) {
                    returnToThreadList();
                  }
                  touchStartX.current = null;
                }}
              >
                {loadingConversation ? (
                  <p className="text-sm text-ink/58">Loading conversation…</p>
                ) : messages.length ? (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <ConversationBubble key={message.id} message={message} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-ink/10 bg-white/70 px-5 py-8 text-sm text-ink/58">
                    No messages yet. Type the first one below.
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="border-t border-ink/8 bg-white px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    placeholder="Write a message..."
                    className="ui-input min-h-[72px] flex-1"
                  />
                  <button type="submit" disabled={sending || !selectedParticipantId || !draft.trim()} className="ui-button-primary sm:self-end">
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
