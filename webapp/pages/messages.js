import { useEffect, useState } from 'react';

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState({});
  const [templateKey, setTemplateKey] = useState('general_checkin');
  const [body, setBody] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    setError('');
    try {
      const r = await fetch('/api/coach/messages' + (athleteId ? `?athlete_id=${athleteId}` : ''));
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
  useEffect(() => { load(); }, []);

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

  return <main className="min-h-screen bg-paper p-6 text-ink"><div className="mx-auto max-w-3xl space-y-4">
    <h1 className="text-2xl font-semibold">Messages</h1>
    <form onSubmit={send} className="rounded-2xl border border-ink/10 bg-white p-4 space-y-2">
      <input placeholder="Athlete ID (coach only)" value={athleteId} onChange={(e)=>setAthleteId(e.target.value)} className="w-full rounded border px-3 py-2"/>
      <select value={templateKey} onChange={(e)=>{setTemplateKey(e.target.value);setBody(templates[e.target.value]||'');}} className="w-full rounded border px-3 py-2">
        {Object.keys(templates).map((k)=><option key={k} value={k}>{k}</option>)}
      </select>
      <textarea value={body} onChange={(e)=>setBody(e.target.value)} rows={3} className="w-full rounded border px-3 py-2" placeholder="Type message" />
      <button disabled={sending} className="rounded-full bg-panel px-4 py-2 text-paper disabled:cursor-not-allowed disabled:opacity-60">{sending ? 'Sending…' : 'Send'}</button>
    </form>
    <section className="rounded-2xl border border-ink/10 bg-white p-4">
      {loading && <p className="text-sm text-ink/60">Loading messages…</p>}
      {!!error && <p className="text-sm text-red-700">{error}</p>}
      {!messages.length && <p className="text-sm text-ink/60">No messages yet.</p>}
      {messages.map((m)=><p key={m.id} className="mt-2 text-sm"><strong>{m.sender_role}:</strong> {m.message_body}</p>)}
    </section>
  </div></main>;
}
