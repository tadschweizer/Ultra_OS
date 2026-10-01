import { useRef, useState } from 'react';
import { clearMe } from '../lib/meClient';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/supportContact';

export default function AccountDataSection() {
  const [confirmation, setConfirmation] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleted, setDeleted] = useState(false);
  const inFlight = useRef(false);
  async function download() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy('export'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/account-export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const archive = await response.json();
      if (!response.ok) throw new Error(archive.error || 'Unable to prepare your records.');
      const url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'threshold-personal-training.json';
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(archive.unavailableSections?.length
        ? 'Download prepared. Some sections are unavailable; the archive lists them. Contact support if you need those records.'
        : 'Your personal training archive is ready. Keep it somewhere private.');
    } catch (problem) { setError(problem.message || 'Download failed. Please retry.'); }
    finally { inFlight.current = false; setBusy(''); }
  }
  async function removeAccount(event) {
    event.preventDefault();
    if (confirmation !== 'DELETE MY ACCOUNT' || inFlight.current) return;
    inFlight.current = true; setBusy('delete'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/delete-account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: confirmation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Deletion did not finish. Please contact support.');
      if (!result.success) throw new Error('Deletion could not be confirmed. Please contact support.');
      clearMe(); setDeleted(true); setOpen(false);
      setNotice(result.auth_cleanup === 'failed'
        ? 'Your Threshold training account was removed, but external sign-in cleanup needs help. Please email support.'
        : 'Your Threshold account was deleted and you are signed out.');
    } catch (problem) { setError(problem.message || 'Deletion failed. Your confirmation is still here so you can retry.'); }
    finally { inFlight.current = false; setBusy(''); }
  }
  return <section aria-labelledby="your-data-heading" className="mt-8 rounded-[30px] border border-ink/10 bg-white p-6 shadow-sm">
    <h2 id="your-data-heading" className="text-2xl font-semibold">Your data</h2>
    {!deleted && <>
      <p className="mt-3 text-sm leading-7 text-ink/80">Download a JSON archive of your profile and personal training records. It excludes provider credentials, uploaded files, other athletes, and coach-only notes. See the <a className="text-ink underline" href="/privacy">privacy notice</a> or contact support for additional records.</p>
      <button type="button" onClick={download} disabled={Boolean(busy)} className="mt-4 min-h-12 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper disabled:opacity-60">{busy === 'export' ? 'Preparing download…' : 'Download my training records'}</button>
      <div className="mt-7 border-t border-ink/10 pt-6">
        <h3 className="font-semibold">Delete your account</h3>
        <p className="mt-2 text-sm leading-7 text-ink/80">Deletion permanently removes your Threshold account and its training records. Download a copy first if you want to keep them. We must stop linked Stripe billing before deletion can proceed; cancelling billing alone does not delete your account. Previously shared records and provider-held copies may have separate retention.</p>
        {!open ? <button type="button" disabled={Boolean(busy)} onClick={() => setOpen(true)} className="mt-3 min-h-11 rounded-full border border-red-700 px-5 py-2 text-sm font-semibold text-red-800">Review account deletion</button>
          : <form onSubmit={removeAccount} className="mt-4 rounded-2xl border border-red-200 p-4">
            <label htmlFor="delete-account-confirmation" className="text-sm font-semibold">Type DELETE MY ACCOUNT to confirm</label>
            <input id="delete-account-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoFocus autoComplete="off" className="mt-3 min-h-12 w-full rounded-xl border border-ink/30 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" />
            <div className="mt-4 flex flex-wrap gap-3">
              <button disabled={confirmation !== 'DELETE MY ACCOUNT' || Boolean(busy)} className="min-h-12 rounded-full bg-red-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === 'delete' ? 'Deleting account…' : 'Permanently delete my account'}</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => { setOpen(false); setConfirmation(''); }} className="min-h-12 rounded-full border border-ink/30 px-5 py-3 text-sm font-semibold">Keep my account</button>
            </div>
          </form>}
      </div>
    </>}
    {error && <p role="alert" className="mt-4 text-sm leading-7 text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm leading-7 text-ink">{notice}</p>}
    <p className="mt-4 text-sm leading-7 text-ink/80">Need help? Email <a className="text-ink font-semibold underline break-all" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.</p>
    {deleted && <a className="mt-4 inline-block text-ink font-semibold underline" href="/">Return to Threshold</a>}
  </section>;
}
