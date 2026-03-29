import { useEffect, useState } from 'react';
import NavMenu from '../components/NavMenu';

/**
 * /invite — Admin-only page for generating invite links.
 *
 * Generates a unique token → full /join URL that you can copy and
 * send to a new user. Only visible to athletes with is_admin = true.
 */
export default function InvitePage() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notAdmin, setNotAdmin] = useState(false);

  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/invites');
        if (res.status === 403) { setNotAdmin(true); return; }
        const data = await res.json();
        setInvites(data.invites || []);
      } catch (_) {
        setError('Failed to load invites.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function createInvite(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setNewLink('');
    setCopied(false);

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || null, notes: notes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Create failed'); return; }

      setNewLink(data.joinUrl);
      setInvites((prev) => [data.invite, ...prev]);
      setEmail('');
      setNotes('');
    } catch (_) {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(newLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }

  if (notAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-8">
        <div className="max-w-sm rounded-[30px] border border-ink/10 bg-white p-8 text-center shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="text-2xl">🔒</p>
          <p className="mt-4 font-semibold text-ink">Admin access required</p>
          <p className="mt-2 text-sm text-ink/55">This page is only available to UltraOS admins.</p>
          <a href="/dashboard" className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
            Back to dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Admin</p>
          </div>
          <NavMenu />
        </div>

        <div className="mb-8 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
            Invite Athletes
          </h1>
          <p className="mt-4 text-sm leading-6 text-ink/70">
            Generate a unique sign-up link. The recipient opens the link, connects Strava, and gets an account — no password required.
          </p>
        </div>

        {/* Create invite form */}
        <section className="mb-6 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-accent">New Invite</p>

          <form onSubmit={createInvite} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink/55">
                Recipient email <span className="font-normal text-ink/35">(optional — for your records only)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="athlete@example.com"
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink/55">
                Notes <span className="font-normal text-ink/35">(optional — e.g. "running club member")</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How do you know this person?"
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper disabled:opacity-40"
            >
              {creating ? 'Generating…' : 'Generate invite link'}
            </button>
          </form>

          {newLink ? (
            <div className="mt-6 rounded-[22px] border border-ink/10 bg-paper p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Invite link — share this</p>
              <p className="break-all rounded-xl bg-white px-4 py-3 text-sm font-mono text-ink shadow-inner">
                {newLink}
              </p>
              <button
                type="button"
                onClick={copyLink}
                className="mt-3 rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink/5"
              >
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
            </div>
          ) : null}
        </section>

        {/* Invite history */}
        <section className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            All Invites {invites.length > 0 ? `(${invites.length})` : ''}
          </p>

          {loading ? (
            <p className="text-sm text-ink/50">Loading…</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-ink/50">No invites generated yet.</p>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className={`flex items-center justify-between rounded-[18px] border border-ink/10 px-4 py-3 ${
                    invite.used_at ? 'bg-ink/4' : 'bg-paper'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {invite.email || <span className="text-ink/40">No email</span>}
                    </p>
                    {invite.notes ? (
                      <p className="mt-0.5 text-xs text-ink/45">{invite.notes}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-ink/35">
                      Created {new Date(invite.created_at).toLocaleDateString()}
                      {invite.used_at
                        ? ` · Used ${new Date(invite.used_at).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {invite.used_at ? (
                      <span className="rounded-full bg-ink/8 px-3 py-1 text-xs font-semibold text-ink/45">Used</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const link = `${window.location.origin}/join?token=${invite.token}`;
                          setNewLink(link);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink transition hover:bg-ink/5"
                      >
                        View link
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 flex justify-center">
          <a href="/admin" className="text-sm font-semibold text-ink/55 underline underline-offset-4">
            ← Back to admin dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
