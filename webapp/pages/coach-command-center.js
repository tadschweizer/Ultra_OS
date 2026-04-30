import { useCallback, useEffect, useMemo, useState } from 'react';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import UpgradePrompt from '../components/UpgradePrompt';
import EmptyStateCard from '../components/EmptyStateCard';
import { usePlan } from '../lib/planUtils';
import { interventionCatalog } from '../lib/interventionCatalog';
import { appMenuLinks } from '../lib/siteNavigation';

// ─── Constants ──────────────────────────────────────────────────────────────

const PROTOCOL_TYPES = interventionCatalog.flatMap((g) => g.types.map((t) => t.label));

const NOTE_TYPES = [
  { value: 'observation', label: 'Observation' },
  { value: 'flag', label: 'Flag' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'race_debrief', label: 'Race Debrief' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'timeline', label: 'Timeline' },
];

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'protocols', label: 'Protocols' },
  { id: 'invitations', label: 'Invitations' },
  { id: 'templates', label: 'Templates' },
  { id: 'settings', label: 'Profile' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function alertBadge(level) {
  if (level === 'red') return 'bg-category-respiratory/55 text-ink';
  if (level === 'yellow') return 'bg-category-nutrition/70 text-ink';
  return 'bg-category-sleep/55 text-ink';
}

function daysLabel(n) {
  if (n === null || n === undefined) return '—';
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n}d ago`;
}

function raceDaysLabel(date) {
  if (!date) return 'No race set';
  const diff = Math.round((new Date(date) - new Date()) / 86400000);
  if (diff < 0) return 'Past';
  if (diff === 0) return 'Race day';
  return `${diff}d away`;
}

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


function extractTags(content) {
  return Array.from(new Set((content.match(/#([a-zA-Z0-9_-]+)/g) || []).map((m) => m.slice(1).toLowerCase())));
}

function inviteUrl(token) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/join?coach_invite=${token}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.28em] text-accent">{label}</p>
      <p className={`mt-3 text-4xl font-semibold ${accent || 'text-white'}`}>{value ?? '—'}</p>
    </div>
  );
}

function AthleteDrawer({ athlete, relationship, protocols, notes, onClose, onAddNote, onAddProtocol }) {
  const [noteForm, setNoteForm] = useState({ content: '', note_type: 'observation', share_with_athlete: false });
  const [noteMsg, setNoteMsg] = useState('');
  const [protocolForm, setProtocolForm] = useState({
    protocol_name: '',
    protocol_type: PROTOCOL_TYPES[0] || '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    description: '',
    compliance_target: 80,
  });
  const [protocolMsg, setProtocolMsg] = useState('');
  const [noteSearch, setNoteSearch] = useState('');
  const [noteTag, setNoteTag] = useState('all');
  const [noteDate, setNoteDate] = useState('');

  async function submitNote(e) {
    e.preventDefault();
    setNoteMsg('');
    if (!noteForm.content.trim()) return;
    const ok = await onAddNote({ ...noteForm, tags: extractTags(noteForm.content), athlete_id: relationship.athlete_id });
    if (ok) { setNoteForm({ content: '', note_type: 'observation', share_with_athlete: false }); setNoteMsg('Note saved.'); }
    else setNoteMsg('Failed to save note.');
  }

  async function submitProtocol(e) {
    e.preventDefault();
    setProtocolMsg('');
    const ok = await onAddProtocol({ ...protocolForm, athlete_id: relationship.athlete_id });
    if (ok) {
      setProtocolForm({ protocol_name: '', protocol_type: PROTOCOL_TYPES[0] || '', start_date: new Date().toISOString().slice(0, 10), end_date: '', description: '', compliance_target: 80 });
      setProtocolMsg('Protocol assigned.');
    } else setProtocolMsg('Failed to assign protocol.');
  }

  const athleteProtocols = protocols.filter((p) => p.athlete_id === relationship.athlete_id);
  const sortedNotes = [...notes].sort((a, b) => (b.is_pinned - a.is_pinned) || (new Date(b.created_at) - new Date(a.created_at)));
  const allTags = Array.from(new Set(sortedNotes.flatMap((n) => n.tags || extractTags(n.content || ''))));
  const visibleNotes = sortedNotes.filter((n) => {
    if (noteSearch && !(n.content || '').toLowerCase().includes(noteSearch.toLowerCase()) && !(n.athlete?.name || '').toLowerCase().includes(noteSearch.toLowerCase())) return false;
    if (noteTag !== 'all' && !(n.tags || extractTags(n.content || '')).includes(noteTag)) return false;
    if (noteDate && !String(n.created_at || '').slice(0, 10).startsWith(noteDate)) return false;
    return true;
  });
  const pinnedNotes = visibleNotes.filter((n) => n.is_pinned);
  const unpinnedNotes = visibleNotes.filter((n) => !n.is_pinned);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-ink/40 backdrop-blur-sm sm:items-stretch" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-full w-full flex-col overflow-y-auto bg-paper sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-paper/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="font-semibold text-ink">{athlete?.name || 'Athlete'}</p>
            <p className="text-xs text-ink/55">{athlete?.email || ''}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-ink/10 px-4 py-2 text-sm text-ink/70 hover:bg-ink/5">Close</button>
        </div>

        <div className="flex-1 space-y-8 px-6 py-6">
          {/* Pinned notes */}
          {pinnedNotes.length > 0 && (
            <section>
              <p className="text-xs uppercase tracking-[0.25em] text-accent">Pinned notes</p>
              <div className="mt-3 space-y-2">
                {pinnedNotes.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-700">{n.note_type}</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink">{n.content}</p>
                    <p className="mt-2 text-xs text-ink/45">{fmt(n.created_at)} · {n.share_with_athlete ? (n.athlete_read_at ? 'Read by athlete' : 'Shared, unread') : 'Private'}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active protocols */}
          <section>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Active protocols</p>
            <div className="mt-3 space-y-2">
              {athleteProtocols.filter((p) => ['assigned', 'in_progress'].includes(p.status)).length === 0 && (
                <p className="text-sm text-ink/55">No active protocols.</p>
              )}
              {athleteProtocols
                .filter((p) => ['assigned', 'in_progress'].includes(p.status))
                .map((p) => (
                  <div key={p.id} className="rounded-2xl border border-ink/10 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-ink">{p.protocol_name}</p>
                      <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink/60">{p.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink/55">{p.protocol_type} · Target {p.compliance_target}% compliance</p>
                    <p className="mt-1 text-xs text-ink/45">{fmt(p.start_date)} → {fmt(p.end_date)}</p>
                  </div>
                ))}
            </div>
          </section>

          {/* Assign protocol form */}
          <section>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Assign protocol</p>
            <form onSubmit={submitProtocol} className="mt-3 space-y-3 rounded-2xl border border-ink/10 bg-white p-4">
              <input
                required
                placeholder="Protocol name"
                value={protocolForm.protocol_name}
                onChange={(e) => setProtocolForm((f) => ({ ...f, protocol_name: e.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              />
              <select
                value={protocolForm.protocol_type}
                onChange={(e) => setProtocolForm((f) => ({ ...f, protocol_type: e.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              >
                {PROTOCOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-ink/55">Start</label>
                  <input type="date" required value={protocolForm.start_date} onChange={(e) => setProtocolForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink/55">End</label>
                  <input type="date" required value={protocolForm.end_date} onChange={(e) => setProtocolForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink" />
                </div>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Compliance target %"
                value={protocolForm.compliance_target}
                onChange={(e) => setProtocolForm((f) => ({ ...f, compliance_target: Number(e.target.value) }))}
                className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              />
              <textarea
                rows={2}
                placeholder="Description (optional)"
                value={protocolForm.description}
                onChange={(e) => setProtocolForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              />
              <button type="submit" className="rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper">Assign protocol</button>
              {protocolMsg && <p className="text-xs text-ink/60">{protocolMsg}</p>}
            </form>
          </section>

          {/* Add note form */}
          <section>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Add note</p>
            <form onSubmit={submitNote} className="mt-3 space-y-3 rounded-2xl border border-ink/10 bg-white p-4">
              <select
                value={noteForm.note_type}
                onChange={(e) => setNoteForm((f) => ({ ...f, note_type: e.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              >
                {NOTE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <textarea
                required
                rows={3}
                placeholder="Your private note…"
                value={noteForm.content}
                onChange={(e) => setNoteForm((f) => ({ ...f, content: e.target.value }))}
                className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink"
              />
              <label className="flex items-center gap-2 text-xs text-ink/70"><input type="checkbox" checked={noteForm.share_with_athlete} onChange={(e) => setNoteForm((f) => ({ ...f, share_with_athlete: e.target.checked }))} /> Share with athlete</label>
              <button type="submit" className="rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper">Save note</button>
              {noteMsg && <p className="text-xs text-ink/60">{noteMsg}</p>}
            </form>
          </section>


          <section>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Find notes</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search content" className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink" />
              <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink" />
              <select value={noteTag} onChange={(e) => setNoteTag(e.target.value)} className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink"><option value="all">All tags</option>{allTags.map((t) => <option key={t} value={t}>#{t}</option>)}</select>
            </div>
          </section>

          {/* Note history */}
          {unpinnedNotes.length > 0 && (
            <section>
              <p className="text-xs uppercase tracking-[0.25em] text-accent">Note history</p>
              <div className="mt-3 space-y-2">
                {unpinnedNotes.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-ink/10 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">{n.note_type}</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink">{n.content}</p>
                    <p className="mt-2 text-xs text-ink/45">{fmt(n.created_at)} · {n.share_with_athlete ? (n.athlete_read_at ? 'Read by athlete' : 'Shared, unread') : 'Private'}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoachCommandCenter() {
  const { coachFeatures } = usePlan();

  // Data state
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sharedTemplates, setSharedTemplates] = useState([]);
  const [notesMap, setNotesMap] = useState({}); // keyed by athlete_id

  // UI state
  const [activeTab, setActiveTab] = useState('roster');
  const [openAthleteId, setOpenAthleteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickNoteByAthlete, setQuickNoteByAthlete] = useState({});

  // Invitation form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  // Template form
  const [templateForm, setTemplateForm] = useState({ name: '', protocol_type: PROTOCOL_TYPES[0] || '', description: '', duration_weeks: '', is_shared: false });
  const [templateMsg, setTemplateMsg] = useState('');

  // Profile edit form
  const [profileForm, setProfileForm] = useState({ display_name: '', bio: '', specialties: '', certifications: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);

  // ── Load everything on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!coachFeatures) return;

    async function loadAll() {
      setLoading(true);
      const [dashRes, relRes, protoRes, invRes, tplRes] = await Promise.all([
        fetch('/api/coach/dashboard'),
        fetch('/api/coach/relationships'),
        fetch('/api/coach/protocols'),
        fetch('/api/coach/invitations'),
        fetch('/api/coach/templates'),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setProfile(d.profile || null);
        setSummary(d.summary || null);
        setProfileForm({
          display_name: d.profile?.display_name || '',
          bio: d.profile?.bio || '',
          specialties: (d.profile?.specialties || []).join(', '),
          certifications: (d.profile?.certifications || []).join(', '),
        });
      }
      if (relRes.ok) { const d = await relRes.json(); setRelationships(d.relationships || []); }
      if (protoRes.ok) { const d = await protoRes.json(); setProtocols(d.protocols || []); }
      if (invRes.ok) { const d = await invRes.json(); setInvitations(d.invitations || []); }
      if (tplRes.ok) { const d = await tplRes.json(); setTemplates(d.templates || []); setSharedTemplates(d.sharedTemplates || []); }

      setLoading(false);
    }

    loadAll();
  }, [coachFeatures]);

  // ── Load notes when drawer opens ──────────────────────────────────────────
  useEffect(() => {
    if (!openAthleteId || notesMap[openAthleteId]) return;

    fetch(`/api/coach/notes?athlete_id=${openAthleteId}`)
      .then((r) => r.json())
      .then((d) => {
        setNotesMap((m) => ({ ...m, [openAthleteId]: d.notes || [] }));
      })
      .catch(() => {});
  }, [openAthleteId, notesMap]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const openRelationship = useMemo(
    () => relationships.find((r) => r.athlete_id === openAthleteId) || null,
    [relationships, openAthleteId]
  );
  const openAthleteData = openRelationship?.athlete || null;
  const openNotes = openAthleteId ? (notesMap[openAthleteId] || []) : [];

  const triageList = useMemo(
    () =>
      [...relationships]
        .filter((r) => r.status === 'active')
        .sort((a, b) => {
          const order = { red: 0, yellow: 1, green: 2 };
          return (order[a.alertLevel] ?? 3) - (order[b.alertLevel] ?? 3);
        }),
    [relationships]
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAddNote = useCallback(async (payload) => {
    const res = await fetch('/api/coach/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const d = await res.json();
    setNotesMap((m) => ({
      ...m,
      [payload.athlete_id]: [d.note, ...(m[payload.athlete_id] || [])],
    }));
    return true;
  }, []);

  const handleAddProtocol = useCallback(async (payload) => {
    const res = await fetch('/api/coach/protocols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const d = await res.json();
    setProtocols((prev) => [d.protocol, ...prev]);
    return true;
  }, []);

  async function sendInvite(e) {
    e.preventDefault();
    setInviteMsg('');
    const res = await fetch('/api/coach/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const d = await res.json();
    if (!res.ok) { setInviteMsg(d.error || 'Failed to send invite.'); return; }
    setInvitations((prev) => [d.invitation, ...prev]);
    setInviteEmail('');
    setInviteMsg('Invitation created.');
  }

  async function revokeInvite(id) {
    const res = await fetch('/api/coach/invitations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'revoked' }),
    });
    if (!res.ok) return;
    setInvitations((prev) => prev.map((inv) => inv.id === id ? { ...inv, status: 'revoked' } : inv));
  }

  async function saveTemplate(e) {
    e.preventDefault();
    setTemplateMsg('');
    const res = await fetch('/api/coach/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...templateForm,
        duration_weeks: templateForm.duration_weeks ? Number(templateForm.duration_weeks) : null,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setTemplateMsg(d.error || 'Failed to save template.'); return; }
    setTemplates((prev) => [d.template, ...prev]);
    setTemplateForm({ name: '', protocol_type: PROTOCOL_TYPES[0] || '', description: '', duration_weeks: '', is_shared: false });
    setTemplateMsg('Template saved.');
  }

  async function saveProfile(e) {
    e.preventDefault();
    setProfileMsg('');
    const res = await fetch('/api/coach/profile-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: profileForm.display_name,
        bio: profileForm.bio || null,
        specialties: profileForm.specialties ? profileForm.specialties.split(',').map((s) => s.trim()).filter(Boolean) : null,
        certifications: profileForm.certifications ? profileForm.certifications.split(',').map((s) => s.trim()).filter(Boolean) : null,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setProfileMsg(d.error || 'Failed to save profile.'); return; }
    setProfile(d.profile);
    setProfileEditing(false);
    setProfileMsg('Profile saved.');
  }

  const navLinks = appMenuLinks;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!coachFeatures) {
    return (
      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold · Coach Command Center</p>
            <NavMenu label="Navigation" links={navLinks} primaryLink={{ href: '/dashboard', label: 'Home', variant: 'secondary' }} />
          </div>
          <section className="mt-12">
            <UpgradePrompt
              featureName="Coach Command Center"
              unlockTier="Coach Monthly or Coach Annual"
              body="The Coach Command Center is available on Coach Monthly and Coach Annual plans."
            />
          </section>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-ink/55">Loading Coach Command Center…</p>
      </main>
    );
  }

  return (
    <>
      {/* Athlete detail drawer */}
      {openAthleteId && openRelationship && (
        <AthleteDrawer
          athlete={openAthleteData}
          relationship={openRelationship}
          protocols={protocols}
          notes={openNotes}
          onClose={() => setOpenAthleteId(null)}
          onAddNote={handleAddNote}
          onAddProtocol={handleAddProtocol}
        />
      )}

      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto max-w-6xl">

          {/* Top bar */}
          <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold · Coach Command Center</p>
            </div>
            <NavMenu label="Navigation" links={navLinks} primaryLink={{ href: '/dashboard', label: 'Home', variant: 'secondary' }} />
          </div>

          <DashboardTabs activeHref="/coach-command-center" tabs={[{ href: '/coach-command-center', label: 'Command Center' }, { href: '/coaches', label: 'Classic View' }]} />

          {/* Hero */}
          <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(140deg,#1b2421_0%,#26332f_42%,#857056_100%)] p-6 text-white md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-accent">Coach Command Center</p>
                <h1 className="font-display mt-4 text-5xl leading-tight md:text-6xl">
                  {profile?.display_name || 'Your Roster'}
                </h1>
                <p className="mt-3 text-white/65 max-w-lg">
                  Manage athletes, assign protocols, and track compliance in one place.
                </p>
              </div>
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3 self-end sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Athletes" value={summary?.total_athletes} />
                <SummaryCard label="Active protocols" value={summary?.active_protocols} />
                <SummaryCard label="Need attention" value={summary?.athletes_needing_attention} accent="text-amber-300" />
                <SummaryCard label="Races in 30d" value={summary?.upcoming_races} accent="text-emerald-300" />
              </div>
            </div>
          </section>

          {/* Tab bar */}
          <div className="mt-8 flex gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? 'bg-panel text-paper'
                    : 'border border-ink/10 bg-white text-ink/70 hover:bg-ink/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── ROSTER TAB ────────────────────────────────────────────────── */}
          {activeTab === 'roster' && (
            <div className="mt-8 space-y-6">
              {relationships.filter((r) => r.status === 'active').length === 0 ? (
                <EmptyStateCard
                  icon="network"
                  title="No active athletes yet."
                  body="Send invitations in the Invitations tab to grow your roster."
                />
              ) : (
                <>
                  {/* Triage feed */}
                  <div className="rounded-[30px] bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm uppercase tracking-[0.25em] text-accent">Triage feed · sorted by urgency</p>
                      <span className="rounded-full border border-ink/10 bg-white/70 px-3 py-1 text-xs text-ink/70">
                        {triageList.filter((r) => r.alertLevel !== 'green').length} needing attention
                      </span>
                    </div>
                    <div className="mt-5 space-y-3">
                      {triageList.length === 0 && (
                        <div className="rounded-[24px] border border-ink/10 bg-white/75 p-4 text-sm text-ink/60">All athletes on track.</div>
                      )}
                      {triageList.map((rel) => {
                        const activeProto = protocols.find((p) => p.athlete_id === rel.athlete_id && ['assigned', 'in_progress'].includes(p.status));
                        return (
                          <article
                            key={rel.id}
                            className="cursor-pointer rounded-[24px] border border-ink/10 bg-white/75 p-4 transition-colors hover:bg-white"
                            onClick={() => setOpenAthleteId(rel.athlete_id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-ink">{rel.athlete?.name || 'Athlete'}</p>
                                <p className="mt-1 text-xs text-ink/60">
                                  Last logged {daysLabel(rel.daysSinceLog)} · {rel.nextRace ? `${rel.nextRace.name} ${raceDaysLabel(rel.nextRace.event_date)}` : 'No upcoming race'}
                                </p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alertBadge(rel.alertLevel)}`}>
                                {rel.alertLevel.charAt(0).toUpperCase() + rel.alertLevel.slice(1)}
                              </span>
                            </div>
                            {activeProto && (
                              <p className="mt-3 text-xs text-ink/65">
                                Protocol: {activeProto.protocol_name} · {activeProto.status}
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>

                  {/* Full roster table */}
                  <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                    <div className="flex items-center justify-between">
                      <p className="text-sm uppercase tracking-[0.25em] text-accent">Full roster</p>
                      <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink/60">{relationships.filter((r) => r.status === 'active').length} active</span>
                    </div>
                    <div className="mt-5 overflow-x-auto">
                      <table className="min-w-full text-left text-sm text-ink">
                        <thead>
                          <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.18em] text-ink/50">
                            <th className="pb-3 pr-5">Athlete</th>
                            <th className="pb-3 pr-5">Group</th>
                            <th className="pb-3 pr-5">Next race</th>
                            <th className="pb-3 pr-5">Last log</th>
                            <th className="pb-3 pr-5">Status</th>
                            <th className="pb-3">Active protocol</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relationships
                            .filter((r) => r.status === 'active')
                            .map((rel) => {
                              const activeProto = protocols.find((p) => p.athlete_id === rel.athlete_id && ['assigned', 'in_progress'].includes(p.status));
                              return (
                                <tr
                                  key={rel.id}
                                  className="cursor-pointer border-b border-ink/8 align-top hover:bg-paper/60"
                                  onClick={() => setOpenAthleteId(rel.athlete_id)}
                                >
                                  <td className="py-4 pr-5 font-semibold">{rel.athlete?.name || '—'}</td>
                                  <td className="py-4 pr-5 text-ink/60">{rel.group_name || '—'}</td>
                                  <td className="py-4 pr-5">
                                    {rel.nextRace ? (
                                      <>
                                        <span>{rel.nextRace.name}</span>
                                        <div className="text-xs text-ink/50">{raceDaysLabel(rel.nextRace.event_date)}</div>
                                      </>
                                    ) : '—'}
                                  </td>
                                  <td className="py-4 pr-5 text-ink/65">{daysLabel(rel.daysSinceLog)}</td>
                                  <td className="py-4 pr-5">
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alertBadge(rel.alertLevel)}`}>
                                      {rel.alertLevel.charAt(0).toUpperCase() + rel.alertLevel.slice(1)}
                                    </span>
                                  </td>
                                  <td className="py-4 text-ink/65">
                                    <div>{activeProto?.protocol_name || '—'}</div>
                                    <div className="mt-2 flex gap-2">
                                      <input
                                        value={quickNoteByAthlete[rel.athlete_id]?.content || ''}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setQuickNoteByAthlete((m) => ({ ...m, [rel.athlete_id]: { ...(m[rel.athlete_id] || { note_type: 'daily', share_with_athlete: false }), content: e.target.value } }))}
                                        placeholder="Quick note…"
                                        className="w-44 rounded-lg border border-ink/10 px-2 py-1 text-xs"
                                      />
                                      <button onClick={async (e) => { e.stopPropagation(); const draft = quickNoteByAthlete[rel.athlete_id]; if (!draft?.content?.trim()) return; const ok = await handleAddNote({ athlete_id: rel.athlete_id, note_type: draft.note_type || 'daily', content: draft.content, share_with_athlete: !!draft.share_with_athlete, tags: extractTags(draft.content) }); if (ok) setQuickNoteByAthlete((m) => ({ ...m, [rel.athlete_id]: { ...m[rel.athlete_id], content: '' } })); }} className="rounded-lg bg-panel px-2 py-1 text-xs font-semibold text-paper">Add</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PROTOCOLS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'protocols' && (
            <div className="mt-8 space-y-6">
              {protocols.length === 0 ? (
                <EmptyStateCard icon="clipboard" title="No protocols assigned yet." body="Open an athlete from the Roster tab to assign their first protocol." />
              ) : (
                <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                  <p className="text-sm uppercase tracking-[0.25em] text-accent">All assigned protocols</p>
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-ink">
                      <thead>
                        <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.18em] text-ink/50">
                          <th className="pb-3 pr-5">Athlete</th>
                          <th className="pb-3 pr-5">Protocol</th>
                          <th className="pb-3 pr-5">Type</th>
                          <th className="pb-3 pr-5">Window</th>
                          <th className="pb-3 pr-5">Status</th>
                          <th className="pb-3">Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {protocols.map((p) => (
                          <tr key={p.id} className="border-b border-ink/8 align-top">
                            <td className="py-4 pr-5 font-semibold">{p.athlete?.name || '—'}</td>
                            <td className="py-4 pr-5">{p.protocol_name}</td>
                            <td className="py-4 pr-5 text-ink/60">{p.protocol_type}</td>
                            <td className="py-4 pr-5 text-ink/65">
                              {fmt(p.start_date)} → {fmt(p.end_date)}
                            </td>
                            <td className="py-4 pr-5">
                              <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink/70">{p.status}</span>
                            </td>
                            <td className="py-4 text-ink/65">{p.compliance_target}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INVITATIONS TAB ───────────────────────────────────────────── */}
          {activeTab === 'invitations' && (
            <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              {/* Send invite form */}
              <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Send invitation</p>
                <form onSubmit={sendInvite} className="mt-5 space-y-4">
                  <input
                    required
                    type="email"
                    placeholder="athlete@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                  />
                  <button type="submit" className="rounded-full bg-panel px-5 py-3 text-sm font-semibold text-paper">
                    Send invite
                  </button>
                  {inviteMsg && <p className="text-sm text-ink/65">{inviteMsg}</p>}
                </form>
                <div className="mt-6 rounded-2xl border border-ink/10 bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-accent">Coach code</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{profile?.coach_code}</p>
                  <p className="mt-1 text-xs text-ink/55">Athletes can use this code on the connections page.</p>
                </div>
              </div>

              {/* Invitations list */}
              <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Sent invitations</p>
                <div className="mt-5 space-y-3">
                  {invitations.length === 0 && (
                    <p className="text-sm text-ink/55">No invitations sent yet.</p>
                  )}
                  {invitations.map((inv) => (
                    <div key={inv.id} className="rounded-2xl border border-ink/10 bg-paper p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{inv.email}</p>
                          <p className="mt-0.5 text-xs text-ink/55">Expires {fmt(inv.expires_at)}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          inv.status === 'accepted' ? 'bg-category-sleep/55 text-ink' :
                          inv.status === 'revoked' ? 'bg-category-respiratory/30 text-ink/60' :
                          'bg-category-nutrition/40 text-ink'
                        }`}>{inv.status}</span>
                      </div>
                      {inv.status === 'pending' && (
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            readOnly
                            value={inviteUrl(inv.token)}
                            className="flex-1 truncate rounded-xl border border-ink/10 bg-white px-3 py-1.5 text-xs text-ink/70"
                            onClick={(e) => e.target.select()}
                          />
                          <button
                            onClick={() => revokeInvite(inv.id)}
                            className="rounded-full border border-ink/10 px-3 py-1.5 text-xs text-ink/60 hover:bg-ink/5"
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TEMPLATES TAB ─────────────────────────────────────────────── */}
          {activeTab === 'templates' && (
            <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              {/* Create template form */}
              <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <p className="text-sm uppercase tracking-[0.25em] text-accent">Create template</p>
                <form onSubmit={saveTemplate} className="mt-5 space-y-4">
                  <input
                    required
                    placeholder="Template name"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                  />
                  <select
                    value={templateForm.protocol_type}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, protocol_type: e.target.value }))}
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                  >
                    {PROTOCOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <textarea
                    rows={2}
                    placeholder="Description"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Duration (weeks)"
                    value={templateForm.duration_weeks}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, duration_weeks: e.target.value }))}
                    className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                  />
                  <label className="flex items-center gap-3 text-sm text-ink/70">
                    <input
                      type="checkbox"
                      checked={templateForm.is_shared}
                      onChange={(e) => setTemplateForm((f) => ({ ...f, is_shared: e.target.checked }))}
                      className="rounded"
                    />
                    Share with all coaches
                  </label>
                  <button type="submit" className="rounded-full bg-panel px-5 py-3 text-sm font-semibold text-paper">Save template</button>
                  {templateMsg && <p className="text-sm text-ink/65">{templateMsg}</p>}
                </form>
              </div>

              {/* Templates list */}
              <div className="space-y-4">
                {templates.length > 0 && (
                  <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                    <p className="text-sm uppercase tracking-[0.25em] text-accent">My templates</p>
                    <div className="mt-4 space-y-3">
                      {templates.map((t) => (
                        <div key={t.id} className="rounded-2xl border border-ink/10 bg-paper p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-sm text-ink">{t.name}</p>
                            {t.is_shared && <span className="rounded-full bg-category-sleep/40 px-2 py-0.5 text-xs text-ink/70">Shared</span>}
                          </div>
                          <p className="mt-1 text-xs text-ink/55">{t.protocol_type}{t.duration_weeks ? ` · ${t.duration_weeks}w` : ''}</p>
                          {t.description && <p className="mt-1.5 text-xs text-ink/65">{t.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sharedTemplates.length > 0 && (
                  <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                    <p className="text-sm uppercase tracking-[0.25em] text-accent">Shared by other coaches</p>
                    <div className="mt-4 space-y-3">
                      {sharedTemplates.map((t) => (
                        <div key={t.id} className="rounded-2xl border border-ink/10 bg-paper p-4">
                          <p className="font-semibold text-sm text-ink">{t.name}</p>
                          <p className="mt-1 text-xs text-ink/55">{t.protocol_type}{t.duration_weeks ? ` · ${t.duration_weeks}w` : ''}</p>
                          {t.description && <p className="mt-1.5 text-xs text-ink/65">{t.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {templates.length === 0 && sharedTemplates.length === 0 && (
                  <EmptyStateCard icon="file" title="No templates yet." body="Create your first template on the left." />
                )}
              </div>
            </div>
          )}

          {/* ── PROFILE/SETTINGS TAB ──────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="mt-8 max-w-lg">
              <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.25em] text-accent">Coach profile</p>
                  {!profileEditing && (
                    <button onClick={() => setProfileEditing(true)} className="rounded-full border border-ink/10 px-4 py-1.5 text-xs text-ink/70 hover:bg-ink/5">Edit</button>
                  )}
                </div>

                {profileEditing ? (
                  <form onSubmit={saveProfile} className="mt-5 space-y-4">
                    <div>
                      <label className="mb-1 block text-xs text-ink/55">Display name</label>
                      <input
                        required
                        value={profileForm.display_name}
                        onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))}
                        className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-ink/55">Bio</label>
                      <textarea
                        rows={3}
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                        className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-ink/55">Specialties (comma-separated)</label>
                      <input
                        placeholder="ultrarunning, gravel, triathlon"
                        value={profileForm.specialties}
                        onChange={(e) => setProfileForm((f) => ({ ...f, specialties: e.target.value }))}
                        className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-ink/55">Certifications (comma-separated)</label>
                      <input
                        placeholder="USAT Level 1, USATF"
                        value={profileForm.certifications}
                        onChange={(e) => setProfileForm((f) => ({ ...f, certifications: e.target.value }))}
                        className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="rounded-full bg-panel px-5 py-3 text-sm font-semibold text-paper">Save</button>
                      <button type="button" onClick={() => setProfileEditing(false)} className="rounded-full border border-ink/10 px-5 py-3 text-sm text-ink/70">Cancel</button>
                    </div>
                    {profileMsg && <p className="text-sm text-ink/65">{profileMsg}</p>}
                  </form>
                ) : (
                  <div className="mt-5 space-y-4 text-sm">
                    <div>
                      <p className="text-xs text-ink/50">Display name</p>
                      <p className="mt-1 font-semibold text-ink">{profile?.display_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink/50">Coach code</p>
                      <p className="mt-1 font-semibold text-ink">{profile?.coach_code || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink/50">Bio</p>
                      <p className="mt-1 text-ink/75 leading-relaxed">{profile?.bio || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink/50">Specialties</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {(profile?.specialties?.length ? profile.specialties : ['—']).map((s) => (
                          <span key={s} className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-ink/50">Certifications</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {(profile?.certifications?.length ? profile.certifications : ['—']).map((c) => (
                          <span key={c} className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">{c}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-ink/50">Subscription</p>
                      <p className="mt-1 text-ink/75">{profile?.subscription_tier} · {profile?.subscription_status}</p>
                    </div>
                    {profileMsg && <p className="text-sm text-ink/65">{profileMsg}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
