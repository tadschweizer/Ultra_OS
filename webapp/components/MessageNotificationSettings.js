import { useEffect, useState } from 'react';
import { notifyMessagesChanged } from '../lib/messageClient.js';

export default function MessageNotificationSettings() {
  const [preferences,setPreferences]=useState(null);const [available,setAvailable]=useState(false);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function load(){try{
    const response=await fetch('/api/message-preferences',{signal:AbortSignal.timeout(10000)});
    const data=await response.json();if(!response.ok)throw new Error();
    setPreferences(data.preferences);setAvailable(data.email_available);setMessage('');
  }catch{setMessage('Notification preferences could not be loaded.');}}
  useEffect(()=>{load();},[]);
  async function save(event){event.preventDefault();if(busy)return;setBusy(true);setMessage('');try{
    const response=await fetch('/api/message-preferences',{method:'PUT',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify(preferences)});
    const data=await response.json();if(!response.ok)throw new Error(data.error || 'Preferences could not be saved.');
    setPreferences(data.preferences);setMessage('Notification preferences saved.');notifyMessagesChanged();
  }catch(error){setMessage(error.message);}finally{setBusy(false);}}
  return <details className="rounded-2xl border border-ink/10 bg-white p-4">
    <summary className="cursor-pointer text-sm font-semibold">Notification preferences</summary>
    {preferences ? <form onSubmit={save} className="mt-3 space-y-3 text-sm">
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={preferences.badge_enabled} disabled={busy}
        onChange={e=>setPreferences({...preferences,badge_enabled:e.target.checked})}/>Show an unread badge</label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={preferences.email_enabled} disabled={busy || (!available && !preferences.email_enabled)}
        onChange={e=>setPreferences({...preferences,email_enabled:e.target.checked})}/>Email me about unread direct messages</label>
      <p className="text-xs text-ink/60">Emails contain a sign-in link, not message text or training details. Turning alerts off keeps your messages and unread counts.</p>
      {!available && <p className="text-xs text-ink/60">Email notifications are currently unavailable.</p>}
      <button disabled={busy} className="rounded-full border border-ink/20 px-4 py-2">{busy?'Saving…':'Save notification preferences'}</button>
    </form> : <button onClick={load} className="mt-3 rounded-full border border-ink/20 px-4 py-2 text-sm">Retry loading preferences</button>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </details>;
}
