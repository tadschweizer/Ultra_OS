import { useEffect, useRef, useState } from 'react';
import { WorkoutEditor } from './TrainingCalendar';
import { dateAfter, prescription } from '../lib/weeklyPlan';
import { useWorkspaceTransport } from '../lib/WorkspaceTransport';

export default function WeeklyPlanner({ relationships, coachId, onPublished }) {
  const {request}=useWorkspaceTransport();
  const [open,setOpen]=useState(false),[week,setWeek]=useState(''),[sourceWeek,setSourceWeek]=useState('');
  const [sourceAthlete,setSourceAthlete]=useState(''),[selected,setSelected]=useState([]),[sources,setSources]=useState([]);
  const [chosen,setChosen]=useState([]),[previews,setPreviews]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [editing,setEditing]=useState(null),[started,setStarted]=useState(false);
  const busyRef=useRef(false), storageKey=`threshold.week-plan.v1:${coachId}`;
  useEffect(()=>{
    if(!coachId)return;
    try {const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.previews?.length){setPreviews(saved.previews);setWeek(saved.week);setStarted(true);setOpen(true);}}catch{}
  },[coachId,storageKey]);
  function persist(rows){localStorage.setItem(storageKey,JSON.stringify({week,previews:rows}));}
  async function json(url,options){const response=await request(url,options);const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load planning data.');return data;}
  async function work(fn){if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{busyRef.current=false;setBusy(false);}}
  const loadSources=kind=>work(async()=>{
    setPreviews([]);
    const data=kind==='library'?await json('/api/workout-library'):await json(`/api/coach/weekly-plan?athlete_id=${sourceAthlete}&week_start=${sourceWeek}`);
    setSources((kind==='library'?data.workouts:data.sources).map(w=>({source_type:kind==='library'?'library':'workout',source_id:w.id,
      source_updated_at:w.updated_at,offset:kind==='library'?0:Math.round((Date.parse(w.workout_date)-Date.parse(sourceWeek))/86400000),
      prescription:{...prescription(w),title:w.title||w.name,structure:w.structure||[]}})));setChosen([]);
  });
  const preview=()=>work(async()=>{
    if(!week||!selected.length||!chosen.length)throw new Error('Choose a destination week, athletes and source workouts.');
    const rows=[];
    for(const athlete_id of selected){
      const destination=await json(`/api/coach/weekly-plan?athlete_id=${athlete_id}&week_start=${week}`);
      rows.push({athlete_id,name:relationships.find(r=>r.athlete_id===athlete_id)?.athlete?.name||'Athlete',existing:destination.workouts,
        request_id:crypto.randomUUID(),occupied_ids:destination.workouts.map(w=>w.id).sort(),targets_confirmed:false,allow_occupied:false,
        entries:chosen.map(index=>{const s=sources[index];return {source_type:s.source_type,source_id:s.source_id,source_updated_at:s.source_updated_at,
          prescription:{...structuredClone(s.prescription),workout_date:dateAfter(week,s.offset)}};})});
    }
    setPreviews(rows);
  });
  function change(i,patch){setPreviews(rows=>rows.map((row,n)=>n===i?{...row,...patch}:row));}
  const publish=()=>work(async()=>{
    if(previews.some(p=>!p.targets_confirmed))throw new Error('Confirm each athlete’s prescriptions before publishing.');
    // Persist the complete immutable operation before any request can commit.
    let rows=previews.map(p=>({...p}));persist(rows);setStarted(true);
    for(let i=0;i<rows.length;i++){
      if(rows[i].confirmed)continue;
      const p=rows[i];
      try{
        const result=await json('/api/coach/weekly-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          request_id:p.request_id,athlete_id:p.athlete_id,week_start:week,occupied_ids:p.occupied_ids,
          allow_occupied:p.allow_occupied,targets_confirmed:p.targets_confirmed,entries:p.entries})});
        rows[i]={...p,confirmed:true,workout_ids:result.workout_ids,error:null};
      }catch(e){rows[i]={...p,error:e.message};}
      persist(rows);setPreviews([...rows]);
    }
    onPublished?.();
  });
  function reset(){if(started&&previews.some(p=>!p.confirmed)&&!window.confirm('Some results are unconfirmed. Check those athletes’ calendars before starting a new operation. Keep existing assignments?'))return;
    if(started)setSelected(previews.filter(p=>!p.confirmed).map(p=>p.athlete_id));
    localStorage.removeItem(storageKey);setStarted(false);setPreviews([]);setError('');}
  return <section className="my-5 rounded-2xl border border-ink/15 bg-white p-4">
    <button className="min-h-11 rounded-full bg-panel px-5 text-paper" onClick={()=>setOpen(v=>!v)}>Plan week</button>
    {open&&<div className="mt-4 space-y-4">
      <p>Choose workouts, check each athlete’s prescription, then publish. Existing sessions stay in place.</p>
      {!started&&<fieldset disabled={busy} className="space-y-3">
        <label className="block">Destination week starts<input aria-label="Destination week starts" type="date" value={week} onChange={e=>{setWeek(e.target.value);setPreviews([]);}} className="ml-2 rounded border p-2"/></label>
        <div className="flex flex-wrap gap-3">{relationships.map(r=><label key={r.athlete_id} className="p-2"><input type="checkbox" checked={selected.includes(r.athlete_id)} onChange={e=>{setSelected(v=>e.target.checked?[...v,r.athlete_id]:v.filter(id=>id!==r.athlete_id));setPreviews([]);}}/> {r.athlete?.name||'Athlete'}</label>)}</div>
        <button onClick={()=>loadSources('library')} className="rounded border p-3">Choose library workouts</button>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Source athlete" value={sourceAthlete} onChange={e=>setSourceAthlete(e.target.value)} className="max-w-full rounded border p-2"><option value="">Source athlete</option>{relationships.map(r=><option key={r.athlete_id} value={r.athlete_id}>{r.athlete?.name||'Athlete'}</option>)}</select>
          <input aria-label="Source week starts" type="date" value={sourceWeek} onChange={e=>setSourceWeek(e.target.value)} className="rounded border p-2"/>
          <button disabled={!sourceWeek||!sourceAthlete} onClick={()=>loadSources('workout')} className="rounded border p-3 disabled:opacity-50">Load source week</button>
        </div>
        {sources.map((s,i)=><label key={`${s.source_id}-${i}`} className="block p-2"><input type="checkbox" checked={chosen.includes(i)} onChange={e=>{setChosen(v=>e.target.checked?[...v,i]:v.filter(n=>n!==i));setPreviews([]);}}/> {s.prescription.title} {s.source_type==='workout'?`— day ${s.offset+1}`:''}</label>)}
        <button onClick={preview} className="rounded border p-3">Preview each athlete</button>
      </fieldset>}
      {previews.map((p,i)=><article key={p.athlete_id} className="rounded-xl border p-3">
        <h3 className="font-semibold">{p.name}</h3>
        <p className="text-sm">{p.existing.length} existing sessions remain unchanged.</p>
        {p.existing.map(w=><p key={w.id} className="text-sm">Existing: {w.workout_date} — {w.title}</p>)}
        {p.entries.map((entry,j)=><div key={j} className="my-2 flex flex-wrap items-center justify-between gap-2 border-b py-2"><div className="min-w-0 break-words"><p>{entry.prescription.workout_date} — {entry.prescription.title} · {entry.prescription.planned_duration_min??'Unknown'} min · {entry.prescription.planned_distance_km??'Unknown'} km</p>
          {entry.prescription.objective&&<p className="text-sm">Purpose: {entry.prescription.objective}</p>}
          {entry.prescription.coach_instructions&&<p className="text-sm">Instructions: {entry.prescription.coach_instructions}</p>}
          {(entry.prescription.structure||[]).map((step,k)=><p key={k} className="text-sm">{step.repeat>1?`${step.repeat} × `:''}{step.type}: {step.duration_min?`${step.duration_min} min `:''}{step.distance_km?`${step.distance_km} km `:''}{step.intensity||''} {step.target_type||''} {step.target_min??step.target_low??''}{step.target_max!=null||step.target_high!=null?`–${step.target_max??step.target_high}`:''} {step.target_units||''} {step.notes||''}</p>)}
          </div>
          <button disabled={busy||started} onClick={()=>setEditing({i,j,initial:{...entry.prescription}})} className="rounded border p-2 disabled:opacity-50">Edit {p.name} workout {j+1}</button></div>)}
        <label className="block py-2"><input disabled={busy||started} type="checkbox" checked={p.allow_occupied} onChange={e=>change(i,{allow_occupied:e.target.checked})}/> Add alongside existing sessions on occupied days</label>
        <label className="block py-2"><input disabled={busy||started} type="checkbox" checked={p.targets_confirmed} onChange={e=>change(i,{targets_confirmed:e.target.checked})}/> I checked dates, instructions and individual targets for {p.name}; no automatic rescaling</label>
        {p.confirmed&&<p role="status">Published {p.workout_ids.length} workouts.</p>}{p.error&&<p role="alert" className="text-red-700">{p.error}</p>}
      </article>)}
      {previews.length>0&&<div className="flex flex-wrap gap-3"><button disabled={busy||previews.every(p=>p.confirmed)} onClick={publish} className="rounded-full bg-panel px-5 py-3 text-paper disabled:opacity-50">{busy?'Publishing…':started?'Retry unconfirmed athletes':'Publish week'}</button><button disabled={busy} onClick={reset} className="rounded border p-3">{started?'Finish / start another week':'Reset preview'}</button></div>}
      {error&&<p role="alert" className="text-red-700">{error}</p>}
      {editing&&<WorkoutEditor initial={editing.initial} canEditPlan preserveSnapshot onClose={()=>setEditing(null)} onSave={async form=>{
        const entries=previews[editing.i].entries.map((entry,j)=>j===editing.j?{...entry,prescription:{...prescription(form),workout_date:form.workout_date}}:entry);
        change(editing.i,{entries,targets_confirmed:false});return {ok:true};
      }}/>}
    </div>}
  </section>;
}
