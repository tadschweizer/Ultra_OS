import { useEffect, useState } from 'react';
import NavMenu from '../../components/NavMenu';
import { appMenuLinks } from '../../lib/siteNavigation';

export default function CoachGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const r = await fetch('/api/coach/groups');
      const d = await r.json();
      setGroups(d.groups || []);
    } catch {
      setMessage('Could not load coach groups right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function createGroup(e) {
    e.preventDefault();
    setMessage('');
    await fetch('/api/coach/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc }) });
    setName('');
    setDesc('');
    setMessage('Group created.');
    load();
  }

  async function assignGroup(group) {
    setMessage(`Assigning template to ${group.name}…`);
    for (const m of (group.coach_group_members || [])) {
      await fetch('/api/coach/protocols', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: templateId, athlete_id: m.athlete_id, start_date: startDate, end_date: endDate }) });
    }
    setMessage(`Assigned template to ${group.name}.`);
  }

  return <main className="min-h-screen bg-paper p-4 text-ink sm:p-6">
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3">
        <h1 className="text-2xl font-semibold">Coach groups</h1>
        <NavMenu label="Coach nav" links={appMenuLinks} primaryLink={{ href: '/coach-command-center', label: 'Coach command center', variant: 'secondary' }} />
      </div>

      {message ? <p className="rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm">{message}</p> : null}

      <form onSubmit={createGroup} className="rounded-2xl border border-ink/10 bg-white p-4 space-y-2">
        <p className="text-sm font-semibold">Create a group</p>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" className="w-full rounded border px-3 py-2" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Why this group exists and what they are training for" className="w-full rounded border px-3 py-2" />
        <button className="rounded-full bg-panel px-4 py-2 text-paper text-sm">Create group</button>
      </form>

      <div className="rounded-2xl border border-ink/10 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold">Assign a protocol template to a group</p>
        <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="Template ID" className="w-full rounded border px-3 py-2" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border px-3 py-2" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded border px-3 py-2" /></div>
      </div>

      {loading ? <p className="text-sm text-ink/60">Loading groups…</p> : null}
      {!loading && groups.length === 0 ? <p className="rounded-2xl border border-ink/10 bg-white p-4 text-sm text-ink/65">No groups yet. Create your first group to batch-assign templates and reduce admin time.</p> : null}
      {groups.map((g) => <section key={g.id} className="rounded-2xl border border-ink/10 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{g.name}</h2><p className="text-sm text-ink/60">{g.description || 'No description yet'}</p></div><button disabled={!templateId} onClick={() => assignGroup(g)} className="rounded-full border px-3 py-1 text-sm disabled:opacity-50">Assign template</button></div><p className="mt-2 text-sm">Members: {(g.coach_group_members || []).length}</p></section>)}
    </div></main>;
}
