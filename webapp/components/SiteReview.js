import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/SiteReview.module.css';

const statuses = { pending_review: 'Pending review', approved: 'Approved', in_progress: 'In progress', awaiting_acceptance: "Awaiting Tad’s acceptance", completed: 'Completed' };
const nextStatuses = { pending_review: [['approved','Approve task']], approved: [['in_progress','Start work']], in_progress: [['awaiting_acceptance','Request acceptance']], awaiting_acceptance: [['completed','Accept and complete'],['in_progress','Return to work']], completed: [['pending_review','Reopen task']] };

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
  const [canManage, setCanManage] = useState(false);
  const [actor, setActor] = useState(null);
  const [panel, setPanel] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(null);
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('active');
  const [submitter, setSubmitter] = useState('all');
  const [updates, setUpdates] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const pending = useRef({});
  const pendingSubmission = useRef(null);
  const [submissionPending, setSubmissionPending] = useState(false);
  const writing = useRef(false);
  const reading = useRef(false);
  const generation = useRef(0);
  const identity = useRef(null);
  const [box, setBox] = useState(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const noteRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch('/api/site-review?access=1', { cache: 'no-store' }).then(async r => {
      const data = r.ok ? await r.json() : {};
      if (active) {
        if (identity.current && identity.current !== data.actor) { generation.current++; setNotes([]); setDraft(null); setUpdates({}); pending.current = {}; pendingSubmission.current = null; setSubmissionPending(false); }
        identity.current = data.actor;
        setEnabled(data.enabled === true);
        setCanManage(data.canManage === true);
        setActor(data.actor || null);
        if (!data.enabled) { setPanel(false); setDraft(null); setNotes([]); setPicking(false); }
      }
    }).catch(() => { if (active) setEnabled(false); });
    return () => { active = false; generation.current++; };
  }, [router.asPath]);

  useEffect(() => {
    if (!panel || !enabled) return;
    const refresh = () => { if (!document.hidden && !writing.current) loadNotes(true); };
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); generation.current++; };
  }, [panel, enabled]);

  useEffect(() => {
    if (panel) (draft ? noteRef.current : panelRef.current)?.focus();
    else if (!picking) triggerRef.current?.focus();
  }, [panel, !!draft]);

  useEffect(() => {
    if (!draft?.note && !Object.values(updates).some(Boolean)) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft?.note, updates]);

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
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) { setNotes([]); setCanManage(false); if (!options?.method) { setEnabled(false); setPanel(false); setDraft(null); setUpdates({}); pending.current = {}; pendingSubmission.current = null; setSubmissionPending(false); } }
      const error = new Error(data.error || 'Could not save. Please retry.'); error.status = res.status; throw error;
    }
    return data;
  }
  async function loadNotes(background = false) {
    if (reading.current) return;
    reading.current = true;
    const epoch = generation.current;
    if (!background) setBusy(true);
    try { const data = await request(); if (epoch === generation.current) { setNotes(data.notes); setCanManage(data.canManage === true); setActor(data.actor); setLoaded(true); setLoadError(''); } }
    catch (error) { if (epoch === generation.current) setLoadError(error.message); }
    finally { reading.current = false; if (!background) setBusy(false); }
  }
  async function save(event) {
    event.preventDefault(); if (writing.current) return; writing.current = true; generation.current++; setBusy(true); setMessage('');
    // A lost response may have committed. Keep both UUID and payload unchanged
    // until the original operation is confirmed; never create a replacement task.
    const submission = pendingSubmission.current || { ...draft };
    pendingSubmission.current = submission; setSubmissionPending(true);
    try {
      await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission) });
      pendingSubmission.current = null; setSubmissionPending(false);
      setDraft(null); setFilter('all'); setSubmitter('all'); setMessage('Feedback submitted for review. Add any further details as an update to this task.');
      const data = await request(); setNotes(data.notes);
    } catch (error) {
      // These rejections are known not to have saved. Conflict/unknown outcomes
      // retain the original request so the user cannot discard and duplicate it.
      if ([400,401,403,405,413].includes(error.status)) { pendingSubmission.current = null; setSubmissionPending(false); }
      setMessage(error.message);
    }
    finally { writing.current = false; setBusy(false); }
  }
  async function change(note, status = null) {
    if (writing.current) return;
    writing.current = true; generation.current++; setBusy(true); setMessage('');
    const message = updates[note.id] || '';
    const action = status ? 'transition' : 'update';
    // Keep the exact operation after an uncertain response, including version and UUID.
    const key = `${note.id}:${action}:${status || ''}`;
    const body = pending.current[key] || { id: note.id, requestId: crypto.randomUUID(), version: note.version, action, status, message };
    pending.current[key] = body;
    try {
      await request({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      delete pending.current[key]; setUpdates(current => ({ ...current, [note.id]: '' }));
      setMessage('Task update saved.');
      const data = await request(); setNotes(data.notes); setLoadError('');
    } catch (error) { if (error.status && error.status < 500) delete pending.current[key]; setMessage(error.message); }
    finally { writing.current = false; setBusy(false); }
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
    const controls = [...panelRef.current.querySelectorAll('button:not(:disabled),a[href],textarea:not(:disabled),select,summary')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (!enabled) return null;
  const pendingFor = id => Object.values(pending.current).filter(change => change.id === id);
  const visibleNotes = notes.filter(n => (filter === 'all' || (filter === 'active' ? n.status !== 'completed' : n.status === filter)) && (submitter === 'all' || n.athlete_id === submitter));
  return <div data-site-review>
    {!panel && !picking && <button ref={triggerRef} className={styles.launcher} onClick={() => { setPanel(true); loadNotes(); }}>Leave feedback{draft ? ' · Draft' : ''}</button>}
    {picking && <>
      <div className={styles.pickbar}>Select something on the page. <button onClick={() => { setPicking(false); setPanel(true); }}>Cancel selection</button></div>
      {box && <div className={styles.highlight} style={box} />}
    </>}
    {panel && <div className={styles.backdrop}>
      <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="review-heading" className={styles.panel} onKeyDown={keyboard}>
        <header><div><small>PRIVATE REVIEW</small><h2 id="review-heading">Feedback tasks</h2></div><button aria-label="Close review panel" onClick={() => setPanel(false)}>Close</button></header>
        <p className={styles.hint}>{canManage ? 'All reviewer feedback. Approve work before it starts, then accept it before completion.' : 'Your feedback and its progress. Tad reviews submissions and accepts completed work.'} Updates refresh every 10 seconds while this panel is open.</p>
        {loadError && <p role="alert">Could not refresh tasks: {loadError} Displayed tasks may be out of date. Use Refresh to retry.</p>}
        {message && <p role="status" className={styles.message}>{message}</p>}
        {draft ? <form onSubmit={save}>
          <p className={styles.context}>{draft.pathname}<br />{draft.element.split(' · ')[0] || 'General page note'}</p>
          <label htmlFor="site-review-note">What would you like changed, or what went wrong?</label>
          <textarea ref={noteRef} id="site-review-note" disabled={busy || submissionPending} required maxLength={5000} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="Example: I clicked Save but my workout did not appear." />
          {submissionPending && !busy && <p>The save response was not confirmed. Retry this unchanged submission first, then add further details as an update to the saved task.</p>}
          <div className={styles.actions}><button className={styles.primary} disabled={busy || !draft.note.trim()}>{busy ? 'Saving…' : submissionPending ? 'Retry submission' : 'Save note'}</button><button type="button" disabled={busy || submissionPending} onClick={() => { if (!draft.note || window.confirm('Discard this unsaved note?')) setDraft(null); }}>Discard draft</button></div>
        </form> : <>
          <div className={styles.actions}><button className={styles.primary} onClick={() => { setPanel(false); setPicking(true); setMessage(''); }}>Select an element</button><button onClick={() => startDraft()}>General page note</button></div>
          <div className={styles.toolbar}><label>Show <select aria-label="Filter review notes" value={filter} onChange={e => setFilter(e.target.value)}><option value="active">Active tasks</option>{Object.entries(statuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}<option value="all">All tasks</option></select></label><button disabled={busy} onClick={() => loadNotes()}>Refresh</button><button disabled={!notes.length || busy} onClick={exportNotes}>Export</button></div>
          {canManage && <label>Submitter <select aria-label="Filter by submitter" value={submitter} onChange={e => setSubmitter(e.target.value)}><option value="all">All reviewers</option>{[...new Map(notes.map(n => [n.athlete_id,n.submitter?.display_name || 'Reviewer'])).entries()].map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
          {busy && <p role="status">Loading…</p>}
          {!busy && loaded && !loadError && !visibleNotes.length && <p className={styles.hint}>No tasks match this filter. Add feedback as you browse.</p>}
          <ol className={styles.notes}>{visibleNotes.map(n => <li key={n.id}>
            <strong>{statuses[n.status]}</strong>
            <a href={n.pathname} onClick={() => setPanel(false)}>{n.pathname}</a>
            <p className={styles.note}>{n.note}</p>
            {n.element && <p className={styles.context}>{n.element.split(' · ')[0]}</p>}
            <p className={styles.context}>Submitted by {n.athlete_id === actor ? 'you' : n.submitter?.display_name || 'Reviewer'} · {new Date(n.created_at).toLocaleString()}<br />Updated {new Date(n.updated_at || n.created_at).toLocaleString()} · {n.viewport}</p>
            <details><summary>Updates and history</summary><ol>{[...(n.history || [])].sort((a,b) => a.created_at.localeCompare(b.created_at)).map(h => <li key={h.id}><strong>{statuses[h.status] || h.status}</strong> · {h.actor_name}<br /><small>{new Date(h.created_at).toLocaleString()}</small><p className={styles.note}>{h.message}</p></li>)}</ol></details>
            <label htmlFor={`update-${n.id}`}>Add an update</label><textarea id={`update-${n.id}`} disabled={busy || pendingFor(n.id).length > 0} maxLength={5000} value={updates[n.id] || ''} onChange={e => setUpdates(current => ({ ...current, [n.id]: e.target.value }))} />
            {pendingFor(n.id).length > 0 && !busy && <p>Confirm the previous change before editing again. {pendingFor(n.id).map(p => <button key={p.requestId} onClick={() => change(n,p.status)}>Retry last change</button>)}</p>}
            <div className={styles.actions}><button disabled={busy || pendingFor(n.id).length > 0 || !updates[n.id]?.trim()} onClick={() => change(n)}>Save update</button>{canManage && (nextStatuses[n.status] || []).map(([status,label]) => <button key={status} disabled={busy || pendingFor(n.id).length > 0} onClick={() => change(n,status)}>{label}</button>)}</div>
          </li>)}</ol>
          {notes.length === 1000 && <p>Showing the latest 1,000 notes.</p>}
        </>}
      </section>
    </div>}
  </div>;
}
