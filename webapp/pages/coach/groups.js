import { useEffect, useState } from 'react';

export default function CoachGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState('');

  const load = async ()=>{ const r=await fetch('/api/coach/groups'); const d=await r.json(); setGroups(d.groups||[]); };
  useEffect(()=>{load();},[]);

  async function createGroup(e){e.preventDefault(); await fetch('/api/coach/groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,description:desc})}); setName(''); setDesc(''); load();}
  async function assignGroup(group){
    for (const m of (group.coach_group_members||[])) {
      await fetch('/api/coach/protocols',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({template_id:templateId,athlete_id:m.athlete_id,start_date:startDate,end_date:endDate})});
    }
    alert('Assigned template to group members.');
  }
  return <main className="min-h-screen bg-paper p-6 text-ink"><div className="mx-auto max-w-4xl space-y-4"><h1 className="text-2xl font-semibold">Coach Groups</h1>
    <form onSubmit={createGroup} className="rounded-2xl border border-ink/10 bg-white p-4 space-y-2"><input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Group name" className="w-full rounded border px-3 py-2"/><textarea value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Description" className="w-full rounded border px-3 py-2"/><button className="rounded-full bg-panel px-4 py-2 text-paper">Create group</button></form>
    <div className="rounded-2xl border border-ink/10 bg-white p-4 space-y-3"><p className="text-sm">Group assign (template id + dates):</p><input value={templateId} onChange={(e)=>setTemplateId(e.target.value)} placeholder="Template ID" className="w-full rounded border px-3 py-2"/><div className="grid grid-cols-2 gap-2"><input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="rounded border px-3 py-2"/><input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="rounded border px-3 py-2"/></div></div>
    {groups.map((g)=> <section key={g.id} className="rounded-2xl border border-ink/10 bg-white p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">{g.name}</h2><p className="text-sm text-ink/60">{g.description}</p></div><button onClick={()=>assignGroup(g)} className="rounded-full border px-3 py-1">Assign template to group</button></div><p className="mt-2 text-sm">Members: {(g.coach_group_members||[]).length}</p></section>)}
  </div></main>;
}
