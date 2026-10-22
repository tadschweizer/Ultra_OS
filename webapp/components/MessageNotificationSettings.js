import { useWorkspaceTransport } from '../lib/WorkspaceTransport';
import { useEffect, useId, useState } from 'react';
import { notifyMessagesChanged } from '../lib/messageClient.js';

export default function MessageNotificationSettings() {
  const { request } = useWorkspaceTransport();
  const [preferences,setPreferences]=useState(null);const [available,setAvailable]=useState(false);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const [checking,setChecking]=useState(false);
  const emailAvailabilityId=useId();
  async function load({availabilityOnly=false}={}){setChecking(true);try{
    const response=await request('/api/message-preferences',{signal:AbortSignal.timeout(10000)});
    const data=await response.json();if(!response.ok)throw new Error();
    if(!availabilityOnly)setPreferences(data.preferences);
    setAvailable(data.email_available === true);
    setMessage(availabilityOnly?'Email availability checked. Your choices are unchanged.':'');
  }catch{setMessage(availabilityOnly?'Email availability could not be checked. Your choices are unchanged.':'Notification preferences could not be loaded.');}
  finally{setChecking(false);}}
  useEffect(()=>{load();},[request]);
  async function save(event){event.preventDefault();if(busy)return;setBusy(true);setMessage('');try{
    const response=await request('/api/message-preferences',{method:'PUT',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify(preferences)});
    const data=await response.json();if(!response.ok)throw new Error(data.error || 'Preferences could not be saved.');
    setPreferences(data.preferences);setAvailable(data.email_available === true);setMessage('Notification preferences saved.');notifyMessagesChanged();
  }catch(error){setMessage(error.message);}finally{setBusy(false);}}
  return <details className="rounded-2xl border border-ink/10 bg-white p-4">
    <summary className="cursor-pointer text-sm font-semibold">Notification preferences</summary>
    {preferences ? <form onSubmit={save} className="mt-3 space-y-3 text-sm">
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={preferences.badge_enabled} disabled={busy || checking}
        onChange={e=>setPreferences({...preferences,badge_enabled:e.target.checked})}/>Show an unread badge</label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={preferences.email_enabled} disabled={busy || checking || (!available && !preferences.email_enabled)} aria-describedby={!available?emailAvailabilityId:undefined}
        onChange={e=>setPreferences({...preferences,email_enabled:e.target.checked})}/>Email me about unread direct messages</label>
      <p className="text-xs text-ink/60">Emails contain a sign-in link, not message text or training details. Turning alerts off keeps your messages and unread counts.</p>
      {!available && <p id={emailAvailabilityId} className="text-sm text-ink/75">Email alerts cannot be turned on while delivery is unavailable. You can still turn off existing alerts and change your unread badge.</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || checking} className="min-h-11 rounded-full border border-ink/20 px-4 py-2">{busy?'Saving…':'Save notification preferences'}</button>
        <button type="button" disabled={busy || checking} onClick={()=>load({availabilityOnly:true})} className="min-h-11 rounded-full border border-ink/20 px-4 py-2">{checking?'Checking availability…':'Refresh email availability'}</button>
      </div>
    </form> : <button disabled={checking} onClick={()=>load()} className="mt-3 rounded-full border border-ink/20 px-4 py-2 text-sm">{checking?'Loading preferences…':'Retry loading preferences'}</button>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </details>;
}
