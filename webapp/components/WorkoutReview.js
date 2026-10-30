import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceTransport } from '../lib/WorkspaceTransport';

export default function WorkoutReview({workout,role,onReply,onAdjust,refreshToken=0,hasUnsavedFeedback=false}) {
  const {request,getAccountScope}=useWorkspaceTransport();
  const [state,setState]=useState(null),[error,setError]=useState(''),[reply,setReply]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(null);
  const lock=useRef(false),scope=getAccountScope?.(),key=`threshold.review.v1:${scope}:${role}:${workout.id}`;
  const load=useCallback(async()=>{
    try{const response=await request(`/api/workout-review?workout_id=${workout.id}&mode=${role}`);const data=await response.json();if(!response.ok)throw new Error(data.error);setState(data);setError('');}
    catch(e){setError(e.message||'Could not load review.');}
  },[request,workout.id,role]);
  useEffect(()=>{load();},[load,workout.updated_at,refreshToken]);
  useEffect(()=>{try{const draft=JSON.parse(localStorage.getItem(key));if(draft){setReply(draft.reply||'');setPending(draft.pending||null);}}catch{}},[key]);
  function saveDraft(text,operation=pending){localStorage.setItem(key,JSON.stringify({reply:text,pending:operation}));}
  async function act(action){
    if(lock.current||!state)return;lock.current=true;setBusy(true);setError('');
    try{
      const body=pending||{workout_id:workout.id,action,revision:state.revision,request_id:crypto.randomUUID(),mode:role,...(action==='reply'?{reply}: {})};
      saveDraft(reply,body);setPending(body);
      const response=await request('/api/workout-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();
      if(!response.ok){if(response.status===409||response.status===403||response.status===400){setPending(null);saveDraft(reply,null);}throw new Error(data.error||'Could not save review.');}
      setPending(null);setState(data);if(body.action==='reply'){setReply('');onReply?.();}saveDraft(body.action==='reply'?'':reply,null);
      await load();
    }catch(e){setError(e.message||'Connection lost. Retry the unconfirmed action.');}finally{lock.current=false;setBusy(false);}
  }
  if(!workout.coach_id||workout.visibility==='coach_private')return null;
  return <section className="mt-4 rounded-xl border border-ink/15 bg-white p-4" aria-label="Session review">
    <h4 className="font-semibold">Session review</h4>
    {state&&<p className="my-2 text-sm">{state.reviewed?'Coach reviewed this result.':'Awaiting coach review.'} {state.request_open?'Response requested.':''}</p>}
    {role==='athlete'&&<><button disabled={busy||!state||!!pending||hasUnsavedFeedback} onClick={()=>act('request')} className="min-h-11 rounded border px-3 disabled:opacity-50">Ask coach to respond</button>{hasUnsavedFeedback&&<p className="mt-2 text-sm">Save your feedback above before asking your coach to respond.</p>}</>}
    {role==='coach'&&<>
      <label className="block">Reply to athlete<textarea aria-label="Review reply" disabled={busy||!!pending} value={reply} onChange={e=>{setReply(e.target.value);saveDraft(e.target.value);}} maxLength={5000} className="mt-2 w-full rounded border p-2"/></label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={busy||!state||!reply.trim()||!!pending} onClick={()=>act('reply')} className="min-h-11 rounded border px-3 disabled:opacity-50">Send reply and review</button>
        <button disabled={busy||!state||!!pending} onClick={()=>act('review')} className="min-h-11 rounded border px-3 disabled:opacity-50">Reviewed — no change</button>
        <button disabled={busy} onClick={onAdjust} className="min-h-11 rounded border px-3">Adjust upcoming session</button>
      </div>
      <p className="mt-2 text-xs">Reviewing without a reply leaves an outstanding response request open. Adjustments save separately.</p>
    </>}
    {pending&&<button disabled={busy} onClick={()=>act(pending.action)} className="mt-2 min-h-11 rounded border px-3">Retry unconfirmed review action</button>}
    {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <button disabled={busy} onClick={load} className="mt-2 min-h-11 rounded border px-3">Refresh review</button>
  </section>;
}

export function CoachReviewQueue(){
  const {request}=useWorkspaceTransport();const [items,setItems]=useState([]),[page,setPage]=useState(0),[more,setMore]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[mustRefresh,setMustRefresh]=useState(false);
  const [distanceUnit,setDistanceUnit]=useState('mi');
  const readVersion=useRef(0),writeLock=useRef(false),receipts=useRef(new Map());
  useEffect(()=>{let active=true;request('/api/settings').then(r=>r.ok?r.json():null).then(data=>{if(active&&['mi','km'].includes(data?.settings?.distance_unit))setDistanceUnit(data.settings.distance_unit);}).catch(()=>{});return()=>{active=false;};},[request]);
  const load=useCallback(async()=>{const version=++readVersion.current;setLoading(true);setError('');try{const response=await request(`/api/workout-review?mode=coach&page=${page}`,{signal:AbortSignal.timeout(15000)});const data=await response.json();if(version!==readVersion.current)return;if(!response.ok){if([401,403].includes(response.status))setItems([]);throw new Error(data.error);}setItems(data.items||[]);setMore(data.has_more);setMustRefresh(false);}catch(e){if(version===readVersion.current)setError(e.message||'Could not load reviews.');}finally{if(version===readVersion.current)setLoading(false);}},[request,page]);
  useEffect(()=>{load();return()=>{readVersion.current++;};},[load]);
  async function reviewUpload(item){
    if(writeLock.current||mustRefresh)return;writeLock.current=true;setBusy(true);setError('');
    const key=`${item.id}:${item.review_revision}`;
    if(!receipts.current.has(key))receipts.current.set(key,{activity_id:item.id,action:'review',revision:item.review_revision,request_id:crypto.randomUUID(),mode:'coach'});
    try{
      const response=await request('/api/workout-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(receipts.current.get(key)),signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!response.ok){if([400,401,403,409].includes(response.status)){receipts.current.delete(key);setMustRefresh(true);}if([401,403].includes(response.status))setItems([]);throw new Error(data.error||'Could not save this review.');}
      receipts.current.delete(key);setItems(current=>current.filter(row=>!(row.id===item.id&&row.source_kind==='activity')));
      await load();
    }catch(e){setError(e.message||'Review could not be confirmed. Retry to check the same saved action.');}
    finally{writeLock.current=false;setBusy(false);}
  }
  return <section className="my-5 rounded-2xl border bg-white p-4" aria-label="Workouts to review"><h2 className="text-xl font-semibold">Workouts to review</h2>
    <p className="text-sm">All uploaded workouts, completed assigned sessions and explicit response requests. A matched upload appears once. Opening a workout or message does not mark it reviewed.</p>
    {error?<p role="alert">{error}</p>:!loading&&!items.length?<p className="py-3">No outstanding session reviews on this page.</p>:null}
    <ul>{items.map(w=><li key={`${w.source_kind||'workout'}:${w.id}`} className="my-2 min-w-0 break-words rounded border p-3">
      {w.workout_date?<a className="block py-2 text-ink underline" href={`/coach/training-calendar?athlete=${w.athlete_id}&week=${w.workout_date}&${w.source_kind==='activity'?'activity':'workout'}=${w.id}`}><strong>{w.name} — {w.title}</strong></a>:<strong>{w.name} — {w.title}</strong>}
      <p className="text-sm">{w.workout_date||'Date unavailable'} · {w.request_open?'Response requested':w.source_kind==='activity'?'Uploaded workout, awaiting review':'Completed, awaiting review'}</p>
      {w.source_kind==='activity'&&<>
        <p className="my-2 text-sm">{w.completed_duration_min!=null?`${w.completed_duration_min} min`:'Duration unavailable'} · {w.completed_distance_km!=null?`${Number((Number(w.completed_distance_km)*(distanceUnit==='mi'?0.621371:1)).toFixed(2))} ${distanceUnit}`:'Distance unavailable'}</p>
        <button disabled={busy||loading||mustRefresh} onClick={()=>reviewUpload(w)} className="min-h-11 rounded border px-3 disabled:opacity-50">Reviewed — no change</button>
      </>}
    </li>)}</ul>
    <div className="flex flex-wrap gap-2"><button disabled={loading||busy} onClick={load} className="min-h-11 rounded border px-3">Refresh reviews</button>{page>0&&<button disabled={loading||busy} onClick={()=>setPage(p=>p-1)}>Previous page</button>}{more&&<button disabled={loading||busy} onClick={()=>setPage(p=>p+1)}>Next page</button>}</div>
  </section>;
}
