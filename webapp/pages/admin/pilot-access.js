import { useState } from 'react';
import { useMe } from '../../lib/planUtils';

export default function PilotAccessPage() {
  const { me, loading } = useMe();
  const [coachId, setCoachId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(action) {
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch(action === 'inspect'
        ? `/api/admin/pilot-access?coach_id=${encodeURIComponent(coachId.trim())}` : '/api/admin/pilot-access', {
        method: action === 'inspect' ? 'GET' : 'POST',
        ...(action === 'inspect' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          coach_id: coachId.trim(), action, reason,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        }) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update pilot access.');
      setResult(data);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (loading) return <main className="p-8">Loading…</main>;
  if (!me?.account?.capabilities?.administrator) return <main className="p-8">Administrator access required.</main>;
  return <main className="mx-auto max-w-2xl px-4 py-8 text-ink">
    <a href="/account" className="underline">Back to account</a>
    <h1 className="mt-6 text-3xl font-semibold">Pilot coach access</h1>
    <p className="mt-3">Approve the closed pilot coach for up to five athletes. This does not change their role or paid subscription. Grant only after verifying the coach identity.</p>
    <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); submit('inspect'); }}>
      <label className="block">Coach profile ID<input className="ui-input mt-1 w-full" required value={coachId} onChange={(e) => setCoachId(e.target.value)} /></label>
      <label className="block">Pilot ends (your local time)<input className="ui-input mt-1 w-full" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label>
      <label className="block">Reason<textarea className="ui-input mt-1 w-full" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="flex flex-wrap gap-3">
        <button className="ui-button-secondary" disabled={busy} type="submit">Inspect coach</button>
        <button className="ui-button-primary" disabled={busy || !expiresAt || !reason.trim()} type="button" onClick={() => submit('grant')}>Grant or renew pilot</button>
        <button className="ui-button-secondary" disabled={busy || !reason.trim()} type="button" onClick={() => submit('revoke')}>Revoke pilot</button>
      </div>
    </form>
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {result && <div role="status" className="ui-card mt-6">
      <p className="font-semibold">{result.profile.display_name || 'Coach'} · {result.action ? 'Saved' : 'Current record'}</p>
      <p>Coach profile: {result.profile.id}</p>
      <p>Account: {result.profile.athlete_id}</p>
      <p>{!result.grant ? 'No pilot grant.' : result.grant.revoked_at ? 'Pilot revoked.' : `Pilot ends ${new Date(result.grant.expires_at).toLocaleString()}`}</p>
      <p>After expiry or revocation, linked athletes return to their own check-in allowance. Historical data and independent paid access remain.</p>
    </div>}
  </main>;
}
