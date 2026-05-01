import { useEffect, useState } from 'react';

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState({});
  const [templateKey, setTemplateKey] = useState('general_checkin');
  const [body, setBody] = useState('');
  const [athleteId, setAthleteId] = useState('');

  async function load() {
    const r = await fetch('/api/coach/messages' + (athleteId ? `?athlete_id=${athleteId}` : ''));
    const d = await r.json();
    setMessages(d.messages || []);
    setTemplates(d.templates || {});
  }
  useEffect(() => { load(); }, []);

  async function send(e) {
    e.preventDefault();
    await fetch('/api/coach/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ athlete_id: athleteId || undefined, template_key: templateKey, message_body: body || undefined }) });
    setBody('');
    load();
  }

  return <main className="min-h-screen bg-paper p-6 text-ink"><div className="mx-auto max-w-3xl space-y-4">
    <h1 className="text-2xl font-semibold">Messages</h1>
    <form onSubmit={send} className="rounded-2xl border border-ink/10 bg-white p-4 space-y-2">
      <input placeholder="Athlete ID (coach only)" value={athleteId} onChange={(e)=>setAthleteId(e.target.value)} className="w-full rounded border px-3 py-2"/>
      <select value={templateKey} onChange={(e)=>{setTemplateKey(e.target.value);setBody(templates[e.target.value]||'');}} className="w-full rounded border px-3 py-2">
        {Object.keys(templates).map((k)=><option key={k} value={k}>{k}</option>)}
      </select>
      <textarea value={body} onChange={(e)=>setBody(e.target.value)} rows={3} className="w-full rounded border px-3 py-2" placeholder="Type message" />
      <button className="rounded-full bg-panel px-4 py-2 text-paper">Send</button>
    </form>
    <section className="rounded-2xl border border-ink/10 bg-white p-4">
      {!messages.length && <p className="text-sm text-ink/60">No messages yet.</p>}
      {messages.map((m)=><p key={m.id} className="mt-2 text-sm"><strong>{m.sender_role}:</strong> {m.message_body}</p>)}
    </section>
  </div></main>;
}
