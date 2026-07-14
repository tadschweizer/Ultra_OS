import { useEffect, useState } from 'react';
import { clearMe, fetchMe, getCachedMe, subscribeMe } from '../lib/meClient';

/**
 * Persistent amber banner shown on every page while an admin is viewing the
 * app as another athlete (read-only impersonation). /api/me reports the
 * impersonation state; exiting clears the view_as cookie and the /api/me
 * sessionStorage cache so the admin's own profile comes back immediately.
 */
export default function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setImpersonating(getCachedMe()?.impersonating || null);
    const unsubscribe = subscribeMe((data) => setImpersonating(data?.impersonating || null));
    fetchMe();
    return unsubscribe;
  }, []);

  if (!impersonating) return null;

  async function exitImpersonation() {
    setExiting(true);
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' });
    } finally {
      clearMe();
      window.location.href = '/admin';
    }
  }

  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md">
      <span>
        Viewing as {impersonating.name || 'athlete'} — read-only. Changes are disabled.
      </span>
      <button
        type="button"
        onClick={exitImpersonation}
        disabled={exiting}
        className="rounded-full border border-white/60 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
      >
        {exiting ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  );
}
