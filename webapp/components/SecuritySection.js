import { useState } from 'react';
import { validatePassword } from '../lib/auth/contracts.js';
import { clearMe } from '../lib/meClient';

const CARD = 'rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]';
const EYEBROW = 'text-sm uppercase tracking-[0.25em] text-accent';
const INPUT = 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink';
const PRIMARY = 'rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper disabled:opacity-50';
const SECONDARY = 'rounded-full border border-ink/10 px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50';

/**
 * Security controls for the account page.
 *
 * Before this existed a user had no way to see how they sign in, change a
 * password, confirm an unverified address, or end a session on a device they
 * no longer have. All of those are things only the account owner can do, so
 * they belong here rather than in support.
 */
export default function SecuritySection({ athlete }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState('');
  const [resending, setResending] = useState(false);

  // A Strava-only account has no Supabase identity, so there is no password to
  // change and nothing to confirm.
  const hasPassword = Boolean(athlete?.supabase_user_id);
  const emailVerified = athlete?.email_verified !== false;

  async function handleChangePassword(event) {
    event.preventDefault();
    setPasswordError('');
    setPasswordNotice('');

    const problem = validatePassword(newPassword, { email: athlete?.email || '' });
    if (problem) {
      setPasswordError(problem);
      return;
    }
    if (newPassword !== confirmation) {
      setPasswordError('Those two passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordError(data.error || 'Could not update your password.');
      } else {
        setPasswordNotice(data.message || 'Password updated.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmation('');
      }
    } catch {
      setPasswordError('Something went wrong. Please try again.');
    }
    setSavingPassword(false);
  }

  async function handleSignOutEverywhere() {
    // Ends this session too, which is the honest behaviour — "everywhere"
    // that excluded the device you are on would be a lie.
    if (!window.confirm('Sign out of Threshold on every device, including this one?')) return;
    setSigningOut(true);
    try {
      const res = await fetch('/api/auth/sign-out-everywhere', { method: 'POST' });
      if (res.ok) {
        clearMe();
        window.location.href = '/login';
        return;
      }
    } catch {
      // Fall through to re-enable the button.
    }
    setSigningOut(false);
  }

  async function handleResendVerification() {
    setResending(true);
    setVerifyNotice('');
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      setVerifyNotice(
        res.ok
          ? 'Confirmation email sent. Check your inbox.'
          : 'Could not send the email. Try again shortly.'
      );
    } catch {
      setVerifyNotice('Could not send the email. Try again shortly.');
    }
    setResending(false);
  }

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className={CARD}>
        <p className={EYEBROW}>How You Sign In</p>

        <div className="mt-5 space-y-3">
          <SignInMethod
            label="Email and password"
            detail={athlete?.email || 'No email on file'}
            active={hasPassword}
          />
          <SignInMethod
            label="Strava"
            detail={athlete?.strava_id ? 'Connected' : 'Not connected'}
            active={Boolean(athlete?.strava_id)}
          />
        </div>

        {!emailVerified ? (
          <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Confirm your email</p>
            <p className="mt-1 text-xs leading-5 text-amber-900/80">
              Your address is not confirmed yet. Until it is, this account cannot be linked to
              existing Threshold data under the same email.
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className={`${SECONDARY} mt-3 border-amber-300`}
            >
              {resending ? 'Sending...' : 'Resend confirmation email'}
            </button>
            {verifyNotice ? <p className="mt-2 text-xs text-amber-900/80">{verifyNotice}</p> : null}
          </div>
        ) : null}

        <div className="mt-6 border-t border-ink/8 pt-5">
          <p className="text-sm font-semibold text-ink">Signed in elsewhere?</p>
          <p className="mt-1 text-sm leading-6 text-ink/70">
            Ends every session on every device, including this one. Use it if you have lost a
            phone or signed in on a computer you no longer have.
          </p>
          <button
            type="button"
            onClick={handleSignOutEverywhere}
            disabled={signingOut}
            className={`${SECONDARY} mt-4`}
          >
            {signingOut ? 'Signing out...' : 'Sign out everywhere'}
          </button>
        </div>
      </div>

      <div className={CARD}>
        <p className={EYEBROW}>Password</p>

        {hasPassword ? (
          <>
            <p className="mt-4 text-sm leading-7 text-ink/76">
              Changing your password signs you out on every other device.
            </p>
            <form onSubmit={handleChangePassword} className="mt-5 space-y-3">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
                className={INPUT}
              />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                className={INPUT}
              />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Confirm new password"
                className={INPUT}
              />
              <button type="submit" disabled={savingPassword} className={PRIMARY}>
                {savingPassword ? 'Saving...' : 'Update password'}
              </button>
            </form>
            {passwordError ? (
              <p role="alert" className="mt-4 text-sm text-red-600">{passwordError}</p>
            ) : null}
            {passwordNotice ? (
              <p role="status" className="mt-4 text-sm text-emerald-700">{passwordNotice}</p>
            ) : null}
            <p className="mt-4 text-xs text-ink/45">
              Forgotten it? <a href="/forgot-password" className="font-semibold text-accent hover:underline">Reset it by email</a>.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-7 text-ink/76">
              This account signs in with Strava, so it has no password. To add one, use the
              password reset flow with the email on your account.
            </p>
            <a href="/forgot-password" className={`${SECONDARY} mt-5 inline-flex`}>
              Set a password
            </a>
          </>
        )}
      </div>
    </section>
  );
}

function SignInMethod({ label, detail, active }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[22px] bg-paper p-4">
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-xs text-ink/55">{detail}</p>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          active ? 'bg-emerald-100 text-emerald-800' : 'bg-ink/6 text-ink/50'
        }`}
      >
        {active ? 'Active' : 'Off'}
      </span>
    </div>
  );
}
