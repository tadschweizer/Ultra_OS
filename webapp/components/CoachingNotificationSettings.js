import { useEffect, useState } from 'react';
import { COACHING_EVENTS } from '../lib/coachingNotifications.js';

export default function CoachingNotificationSettings() {
  const [settings, setSettings] = useState(null), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [consent, setConsent] = useState(false), [codeSent, setCodeSent] = useState(false);
  async function request(path, method = 'GET', body) {
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save. Please retry.');
    return data;
  }
  async function load() {
    try { setSettings(await request('/api/coaching-notification-settings')); } catch (error) { setStatus(error.message); }
  }
  useEffect(() => { load(); }, []);
  async function toggle(key, enabled) {
    setBusy(true); setStatus('Saving…');
    try {
      setSettings(await request('/api/coaching-notification-settings', 'PATCH', { preferences: { [key]: enabled } }));
      setStatus('Saved.');
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  async function managePhone(action) {
    setBusy(true); setStatus('');
    try {
      await request('/api/coaching-notifications/phone', 'POST', { action, phone: phone.trim(), code: code.trim(), consent });
      setCodeSent(action === 'start');
      setStatus(action === 'start' ? 'Code sent. Enter it below.' : action === 'check' ? 'Phone verified. Choose your text alerts below.' : 'Phone removed. Text alerts are stopped.');
      await load();
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 rounded-3xl border border-ink/10 bg-white p-6" aria-labelledby="training-alerts-title">
    <h2 id="training-alerts-title" className="text-2xl font-semibold">Email and text alerts</h2>
    <p className="mt-2 text-sm text-ink/70">Choose how you hear about training. These switches control your own alerts. Your coach and athletes choose theirs separately.</p>
    <p className="mt-2 text-sm text-ink/70">Uploads and completions alert the coach; new assigned workouts alert the athlete. Comments alert the other person. Private drafts do not send alerts.</p>
    {!settings ? <button className="mt-4 underline" onClick={load}>Load notification settings</button> : <>
      {!settings.available.email && <p className="mt-4 text-sm">Email alerts are not available yet.</p>}
      {settings.available.email && !settings.email_verified && <p className="mt-4 text-sm">Verify your account email before email alerts can be delivered. You can still save your choices here.</p>}
      {!settings.available.sms && <p className="mt-2 text-sm">Text alerts are not available yet.</p>}
      {(settings.available.sms || settings.phone) && <fieldset disabled={busy} className="mt-6 space-y-3">
        <legend className="font-semibold">Your phone</legend>
        {settings.phone && <div className="flex flex-wrap items-center gap-3"><p>{settings.phone} — {settings.sms_stopped ? 'texts stopped' : settings.phone_verified ? 'verified' : 'not verified'}</p>
          <button type="button" className="text-ink underline" onClick={() => managePhone('remove')}>Remove phone</button></div>}
        {settings.sms_stopped && <p className="text-sm">If you replied STOP, reply START to the same number, then verify your phone again here.</p>}
        {settings.available.sms && <>
          <label className="block text-sm">Phone number, including country code
            <input type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+18015551234" className="mt-1 block w-full max-w-sm rounded-lg border p-3" /></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
            <span>I agree to receive a verification code and the Threshold training texts I select at this number. Frequency varies. Message and data rates may apply. Reply STOP to stop. Texts are optional. <a href="/privacy" className="text-ink underline">Privacy</a> · <a href="/terms" className="text-ink underline">Terms</a></span></label>
          <button type="button" disabled={!phone || !consent} onClick={() => managePhone('start')} className="rounded-lg border px-4 py-3 disabled:opacity-50">Send verification code</button>
          {codeSent && <div className="space-y-2"><label className="block text-sm">Verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} className="mt-1 block w-full max-w-sm rounded-lg border p-3" /></label>
            <button type="button" onClick={() => managePhone('check')} className="rounded-lg border px-4 py-3">Verify phone</button></div>}
        </>}
      </fieldset>}
      <fieldset disabled={busy} className="mt-6 divide-y">
        <legend className="sr-only">Training notification preferences</legend>
        {COACHING_EVENTS.map(({ key, label }) => <div key={key} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <p className="text-sm font-medium">{label}</p>
          <div className="flex gap-6">{['email', 'sms'].map(channel => {
            const prefKey = `${key}_${channel}`, checked = Boolean(settings.preferences[prefKey]);
            const unavailable = !settings.available[channel] || channel === 'sms' && (!settings.phone_verified || settings.sms_stopped);
            return <label key={channel} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!checked && unavailable}
              aria-label={`${label}: ${channel === 'sms' ? 'Text' : 'Email'}`} onChange={e => toggle(prefKey, e.target.checked)} />{channel === 'sms' ? 'Text' : 'Email'}</label>;
          })}</div>
        </div>)}
      </fieldset>
      <p className="mt-3 text-sm text-ink/70">Alerts link back to Threshold without including private workout details. Older imported history does not send alerts. <a href="/messages" className="text-ink underline">Manage direct-message emails in Messages.</a></p>
    </>}
    <p role="status" aria-live="polite" className="mt-4 text-sm">{status}</p>
  </section>;
}
