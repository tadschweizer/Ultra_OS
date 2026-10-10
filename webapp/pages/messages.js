import { useWorkspaceTransport } from '../lib/WorkspaceTransport';
import useMessageDraft from '../lib/useMessageDraft.js';
import MessageWorkspace from '../components/MessageWorkspace.js';
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
  const { request } = useWorkspaceTransport();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [templates, setTemplates] = useState({});
  const [athleteId, setAthleteId] = useState('');
  const [role, setRole] = useState('athlete');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const sendInFlight = useRef(false);
  const selectedRef = useRef('');
  const requestVersion = useRef(0);
  const requestPending = useRef(false);
  const requestAbort = useRef(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadRef = useRef(null);
  const historyLoaded = useRef(false);
  const [mobile, setMobile] = useState(null);
  const threadOpen = mobile === false || Boolean(router.query.athlete_id);
  const viewRef = useRef({ mobile: null, threadOpen: false });
  viewRef.current = { mobile, threadOpen, recipient: router.query.athlete_id || selectedRef.current, mode: router.query.mode === 'athlete' ? 'athlete' : 'coach' };
  const composerRef = useRef(null);
  const focusComposer = useRef(false);
  const historyRef = useRef(null);
  const focusRecipient = useRef(null);
  const requestedMode = router.query.mode === 'athlete' ? 'athlete' : 'coach';

  useEffect(() => {
    // Cached conversations belong to this transport/account and viewer role.
    // Recipient navigation may retain them; a role/account change may not.
    setInboxLoaded(false); setLoadError(''); setConversations([]); setRole(requestedMode);
  }, [request, requestedMode]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

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
      const r = await request(`/api/coach/messages?${query.toString()}`, { signal: controller.signal });
      const d = await r.json();
      if (version !== requestVersion.current) return;
      if (!r.ok) { if (r.status === 403 || r.status === 401) { setMessages([]); setConversations([]); setInboxLoaded(false); } throw new Error('Failed to load messages'); }
      if (!Array.isArray(d.conversations) || !Array.isArray(d.messages)) throw new Error('Invalid inbox response');
      setInboxLoaded(true); setLoadError('');
      setError((previous) => previous.startsWith('Unable to load') || previous.startsWith('Messages loaded') ? '' : previous);
      const nextConversations = d.conversations || [];
      const visible = viewRef.current.threadOpen && document.visibilityState !== 'hidden'
        && (!targetAthleteId || targetAthleteId === viewRef.current.recipient);
      setMessages((previous) => !viewRef.current.threadOpen ? [] : nextConversations.length && (older || historyLoaded.current) ? mergeMessages(previous, d.messages || []) : (d.messages || []));
      if (older || !historyLoaded.current) setNextCursor(d.next_cursor || null);
      if (older) historyLoaded.current = true;
      setConversations(nextConversations);
      setTemplates(d.templates || {});
      setRole(d.role || 'athlete');
      if (d.role === 'athlete' && nextConversations.length) { selectedRef.current = nextConversations[0].athlete_id; setAthleteId(nextConversations[0].athlete_id); }

      if (visible && !keepSelection && !targetAthleteId && d.role === 'coach' && nextConversations.length) {
        const firstAthleteId = nextConversations[0].athlete_id;
        selectedRef.current = firstAthleteId;
        setAthleteId(firstAthleteId);
        await load(firstAthleteId, { keepSelection: true });
      } else if (visible && nextConversations.length) {
        const acknowledged = await acknowledgeMessages(d.messages || [], d.role, targetAthleteId || nextConversations[0].athlete_id, request);
        if (version === requestVersion.current) {
          if (!acknowledged) setError('Messages loaded, but read status could not be saved. We will retry.');
          else setConversations((items) => items.map((item) => item.athlete_id === (targetAthleteId || nextConversations[0].athlete_id) ? { ...item, unread_count: Math.max(0, item.unread_count - (d.messages || []).filter((m) => m.sender_role !== d.role && !m.read_at).length) } : item));
        }
      }
    } catch (err) {
      if (version !== requestVersion.current) return;
      setLoadError('Unable to load messages right now. Please try again.');
      setError('Unable to load messages right now. Please try again.');
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion.current) { requestPending.current = false; setLoading(false); setLoadingOlder(false); }
    }
  }

  useEffect(() => {
    if (!router.isReady || mobile === null) return;
    const queryAthleteId = typeof router.query.athlete_id === 'string' ? router.query.athlete_id : '';
    historyLoaded.current = false;
    selectedRef.current = queryAthleteId;
    setAthleteId(queryAthleteId); setMessages([]); setNextCursor(null); setLoading(true); setError('');
    load(queryAthleteId, { keepSelection: Boolean(queryAthleteId) });
    return () => { requestVersion.current += 1; requestAbort.current?.abort(); };
  }, [router.isReady, router.query.athlete_id, requestedMode, request, mobile]);

  loadRef.current = load;
  useEffect(() => {
    if (!router.isReady) return;
    const refresh = () => { if (document.visibilityState !== 'hidden' && !sendInFlight.current && !loadingOlder) loadRef.current(viewRef.current.threadOpen ? selectedRef.current : '', { keepSelection: true, background: true }); };
    const timer = setInterval(refresh, 4000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); };
  }, [router.isReady, loadingOlder]);

  async function selectConversation(nextAthleteId) {
    if (sendInFlight.current) return;
    // URL selection makes reload and browser Back restore the same view. Seeds
    // belong to their original contextual recipient, not every later selection.
    const query = { mode: requestedMode, athlete_id: nextAthleteId };
    if (nextAthleteId === router.query.athlete_id) return;
    await router.push(`/messages?${new URLSearchParams(query)}`, undefined, { shallow: true, scroll: false });
  }

  async function showConversations() {
    if (sendInFlight.current) return;
    focusRecipient.current = athleteId;
    await router.push(`/messages?${new URLSearchParams({ mode: requestedMode })}`, undefined, { shallow: true, scroll: false });
  }

  async function send(e) {
    e.preventDefault();
    if (sendInFlight.current || !canSend) return;
    sendInFlight.current = true;
    const recipient = selectedRef.current;
    const stillSelected = () => selectedRef.current === recipient && viewRef.current.mode === requestedMode && viewRef.current.threadOpen;
    setSending(true);
    setError('');
    try {
      const messageId = await draft.prepareSend();
      const r = await request('/api/coach/messages', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: requestedMode,
          client_message_id: messageId,
          athlete_id: role === 'coach' ? athleteId || undefined : undefined,
          template_key: role === 'coach' ? templateKey : undefined,
          message_body: body || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to send');
      draft.sent(messageId);
      focusComposer.current = stillSelected();
      notifyMessagesChanged();
      if (stillSelected()) await load(athleteId, { keepSelection: true });
    } catch (err) {
      draft.sendFailed();
      if (stillSelected()) setError('Unable to send message. Please check required fields and retry.');
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  }

  const selectedConversation = useMemo(
    () => (athleteId ? conversations.find((conversation) => conversation.athlete_id === athleteId) : conversations[0]) || null,
    [athleteId, conversations]
  );
  const seedTemplate = typeof router.query.template_key === 'string' && templates[router.query.template_key] ? router.query.template_key : 'general_checkin';
  const seedBody = typeof router.query.message_body === 'string' ? router.query.message_body : (router.query.template_key ? templates[seedTemplate] || '' : '');
  const draft = useMessageDraft({ role, conversation: threadOpen ? selectedConversation : null, seedBody, seedTemplate });
  const { body, setBody, templateKey, setTemplateKey } = draft;
  const selectedTemplate = TEMPLATE_META[templateKey];
  const canSend = draft.ready && !loading && Boolean(body.trim()) && Boolean(selectedConversation) && (role === 'athlete' || Boolean(athleteId));

  useEffect(() => {
    if (!sending && focusComposer.current) { composerRef.current?.focus(); focusComposer.current = false; }
  }, [sending]);
  useEffect(() => {
    if (threadOpen || !focusRecipient.current) return;
    document.querySelector(`[data-conversation="${focusRecipient.current}"]`)?.focus();
    focusRecipient.current = null;
  }, [threadOpen, conversations]);
  useEffect(() => {
    // Once older pages are loaded, preserve the reader's scroll position.
    const history = historyRef.current;
    if (history && !loadingOlder && !historyLoaded.current) history.scrollTop = history.scrollHeight;
  }, [messages, athleteId]);

  return <MessageWorkspace {...{role,conversations,messages,athleteId,threadOpen,loading,error,inboxLoaded,loadError,sending,loadingOlder,nextCursor,selectedConversation,selectConversation,showConversations,load,historyRef,composerRef,send,draft,canSend,templates,selectedTemplate,conversationName,formatTimestamp}} templateMeta={TEMPLATE_META} loadOlder={()=>{setLoadingOlder(true);load(athleteId,{keepSelection:true,older:true});}} />;
}
