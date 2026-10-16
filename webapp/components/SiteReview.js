import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/SiteReview.module.css';

function describeElement(target) {
  const el = target.closest('button,a,input,textarea,select,label,h1,h2,h3,[role="button"]') || target;
  const parts = [];
  let node = el;
  for (let i = 0; node && node !== document.body && i < 5; i++, node = node.parentElement) {
    const siblings = [...(node.parentElement?.children || [])].filter(s => s.tagName === node.tagName);
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
  }
  // Never collect input values or whole section text (messages/athlete details).
  const label = el.getAttribute('aria-label') || (el.matches('button,a,h1,h2,h3,label') ? el.textContent : '') || el.tagName.toLowerCase();
  return `${label.trim().slice(0, 120)} · ${parts.join(' > ')}`.slice(0, 1000);
}

export default function SiteReview() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [panel, setPanel] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(null);
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('open');
  const [box, setBox] = useState(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const noteRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch('/api/site-review?access=1', { cache: 'no-store' }).then(async r => {
      const data = r.ok ? await r.json() : {};
      if (active) {
        setEnabled(data.enabled === true);
        if (!data.enabled) { setPanel(false); setDraft(null); setNotes([]); setPicking(false); }
      }
    }).catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, [router.asPath]);

  useEffect(() => {
    if (panel) (draft ? noteRef.current : panelRef.current)?.focus();
    else if (!picking) triggerRef.current?.focus();
  }, [panel, !!draft]);

  useEffect(() => {
    if (!draft?.note) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft?.note]);

  function startDraft(element = '') {
    setDraft({ id: crypto.randomUUID(), pathname: window.location.pathname, element, viewport: `${innerWidth} × ${innerHeight}`, note: '' });
    setMessage(''); setPanel(true);
  }

  useEffect(() => {
    if (!picking) { setBox(null); return; }
    const move = event => {
      if (!(event.target instanceof Element) || event.target.closest('[data-site-review]')) { setBox(null); return; }
      const r = event.target.getBoundingClientRect();
      setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    const pick = event => {
      if (!(event.target instanceof Element) || event.target.closest('[data-site-review]')) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      startDraft(describeElement(event.target)); setPicking(false);
    };
    const escape = event => { if (event.key === 'Escape') { setPicking(false); setPanel(true); } };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('click', pick, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('click', pick, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [picking]);

  async function request(options) {
    const res = await fetch('/api/site-review', { cache: 'no-store', ...options });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save. Please retry.');
    return data;
  }
  async function loadNotes() {
    setBusy(true); setMessage('');
    try { const data = await request(); setNotes(data.notes); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      setDraft(null); setMessage('Note saved. You can close this panel and keep testing.');
      const data = await request(); setNotes(data.notes);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function toggle(note) {
    setBusy(true); setMessage('');
    try {
      const data = await request({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: note.id, status: note.status === 'open' ? 'resolved' : 'open' }) });
      setNotes(current => current.map(n => n.id === note.id ? data.note : n));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  function exportNotes() {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'threshold-review-notes.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function keyboard(event) {
    if (event.key === 'Escape') { setPanel(false); return; }
    if (event.key !== 'Tab') return;
    const controls = [...panelRef.current.querySelectorAll('button:not(:disabled),a[href],textarea,select')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (!enabled) return null;
  return <div data-site-review>
    {!panel && !picking && <button ref={triggerRef} className={styles.launcher} onClick={() => { setPanel(true); loadNotes(); }}>Leave feedback{draft ? ' · Draft' : ''}</button>}
    {picking && <>
      <div className={styles.pickbar}>Select something on the page. <button onClick={() => { setPicking(false); setPanel(true); }}>Cancel selection</button></div>
      {box && <div className={styles.highlight} style={box} />}
    </>}
    {panel && <div className={styles.backdrop}>
      <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="review-heading" className={styles.panel} onKeyDown={keyboard}>
        <header><div><small>PRIVATE REVIEW</small><h2 id="review-heading">Your site notes</h2></div><button aria-label="Close review panel" onClick={() => setPanel(false)}>Close</button></header>
        <p className={styles.hint}>Only your account can use this. Close the panel to test the website normally.</p>
        {message && <p role="status" className={styles.message}>{message}</p>}
        {draft ? <form onSubmit={save}>
          <p className={styles.context}>{draft.pathname}<br />{draft.element.split(' · ')[0] || 'General page note'}</p>
          <label htmlFor="site-review-note">What would you like changed, or what went wrong?</label>
          <textarea ref={noteRef} id="site-review-note" required maxLength={5000} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="Example: I clicked Save but my workout did not appear." />
          <div className={styles.actions}><button className={styles.primary} disabled={busy || !draft.note.trim()}>{busy ? 'Saving…' : 'Save note'}</button><button type="button" disabled={busy} onClick={() => { if (!draft.note || window.confirm('Discard this unsaved note?')) setDraft(null); }}>Discard draft</button></div>
        </form> : <>
          <div className={styles.actions}><button className={styles.primary} onClick={() => { setPanel(false); setPicking(true); setMessage(''); }}>Select an element</button><button onClick={() => startDraft()}>General page note</button></div>
          <div className={styles.toolbar}><label>Show <select aria-label="Filter review notes" value={filter} onChange={e => setFilter(e.target.value)}><option value="open">Open notes</option><option value="resolved">Resolved notes</option><option value="all">All notes</option></select></label><button disabled={busy} onClick={loadNotes}>Refresh</button><button disabled={!notes.length || busy} onClick={exportNotes}>Export</button></div>
          {busy && <p role="status">Loading…</p>}
          {!busy && !notes.some(n => filter === 'all' || n.status === filter) && <p className={styles.hint}>No {filter === 'all' ? '' : filter} notes yet. Add a note as you browse.</p>}
          <ol className={styles.notes}>{notes.filter(n => filter === 'all' || n.status === filter).map(n => <li key={n.id}>
            <a href={n.pathname} onClick={() => setPanel(false)}>{n.pathname}</a>
            <p className={styles.note}>{n.note}</p>
            {n.element && <p className={styles.context}>{n.element.split(' · ')[0]}</p>}
            <footer><small>{new Date(n.created_at).toLocaleDateString()} · {n.viewport}</small><button disabled={busy} onClick={() => toggle(n)}>{n.status === 'open' ? 'Mark resolved' : 'Reopen'}</button></footer>
          </li>)}</ol>
          {notes.length === 1000 && <p>Showing the latest 1,000 notes.</p>}
        </>}
      </section>
    </div>}
  </div>;
}
