import { useEffect, useState } from 'react';
import NavMenu from '../../components/NavMenu';
import { appMenuLinks } from '../../lib/siteNavigation';

export default function CoachGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
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
      const [groupsRes, templatesRes] = await Promise.all([
        fetch('/api/coach/groups'),
        fetch('/api/coach/templates'),
      ]);
      const groupsData = await groupsRes.json();
      setGroups(groupsData.groups || []);
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates([...(templatesData.templates || []), ...(templatesData.sharedTemplates || [])]);
      }
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
    const members = group.coach_group_members || [];
    if (!members.length) {
      setMessage(`${group.name} has no athletes yet — add athletes from the Command Center roster first.`);
      return;
    }
    setMessage(`Assigning protocol to ${group.name}…`);
    for (const m of members) {
      await fetch('/api/coach/protocols', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: templateId, athlete_id: m.athlete_id, start_date: startDate, end_date: endDate }) });
    }
    const templateName = templates.find((t) => t.id === templateId)?.name || 'template';
    setMessage(`Assigned "${templateName}" to ${members.length} athlete${members.length === 1 ? '' : 's'} in ${group.name}.`);
  }

  return <main className="min-h-screen bg-paper p-4 text-ink sm:p-6">
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Coach Tools</p>
          <h1 className="mt-1 text-2xl font-semibold">Training Groups</h1>
        </div>
        <NavMenu label="Coach nav" links={appMenuLinks} primaryLink={{ href: '/coach-command-center', label: 'Coach command center', variant: 'secondary' }} />
      </div>

      <p className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink/65">
        Group similar athletes — same race block, same protocol phase — and assign protocols to everyone at once. One assignment, the whole group tracked.
      </p>

      {message ? <p className="rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm">{message}</p> : null}

      <form onSubmit={createGroup} className="rounded-2xl border border-ink/10 bg-white p-4 space-y-2">
        <p className="text-sm font-semibold">Create a group</p>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name (e.g. Spring 100K block)" className="w-full rounded border px-3 py-2" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Why this group exists and what they are training for" className="w-full rounded border px-3 py-2" />
        <button className="rounded-full bg-panel px-4 py-2 text-paper text-sm">Create group</button>
      </form>

      <div className="rounded-2xl border border-ink/10 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold">Assign a protocol template to a group</p>
        {templates.length ? (
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
            <option value="">Select a protocol template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.protocol_type ? ` · ${t.protocol_type}` : ''}{t.duration_weeks ? ` · ${t.duration_weeks}w` : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="rounded-xl border border-ink/8 bg-paper px-3 py-2 text-sm text-ink/60">
            No protocol templates yet. Create templates in the <a href="/coach-command-center" className="font-semibold text-accent hover:underline">Command Center</a> protocol workspace first.
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs text-ink/50">Start date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm text-ink" />
          </label>
          <label className="text-xs text-ink/50">End date
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm text-ink" />
          </label>
        </div>
        <p className="text-xs text-ink/45">Pick a template and dates, then use “Assign to group” on any group below.</p>
      </div>

      {loading ? <p className="text-sm text-ink/60">Loading groups…</p> : null}
      {!loading && groups.length === 0 ? (
        <section className="rounded-2xl border border-ink/10 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-ink">No groups yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/60">
            The workflow: create a group here, add athletes to it from your Command Center roster, then assign a protocol template to the whole group in one click.
          </p>
        </section>
      ) : null}
      {groups.map((g) => {
        const members = g.coach_group_members || [];
        return (
          <section key={g.id} className="rounded-2xl border border-ink/10 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{g.name}</h2>
                <p className="text-sm text-ink/60">{g.description || 'No description yet'}</p>
              </div>
              <button disabled={!templateId} onClick={() => assignGroup(g)} className="rounded-full border px-3 py-1 text-sm disabled:opacity-50">Assign to group</button>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">
              {members.length} athlete{members.length === 1 ? '' : 's'}
            </p>
            {members.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {members.map((m) => (
                  <span key={m.athlete_id} className="rounded-full border border-ink/10 bg-paper px-3 py-1 text-xs font-semibold text-ink/70">
                    {m.athletes?.name || m.athletes?.email || 'Athlete'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink/55">No athletes yet — add them from the Command Center roster.</p>
            )}
          </section>
        );
      })}
    </div></main>;
}
