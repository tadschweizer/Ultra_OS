import { useState } from 'react';
import AuthShell, { authInputClass, authLabelClass, authSubmitClass } from '../components/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      // The endpoint answers the same way whether or not the account exists,
      // and so does this screen — naming which addresses are registered would
      // leak the membership list to anyone with a browser.
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="Check Your Inbox"
        title="Reset link sent"
        notice={`If an account exists for ${email}, a link to choose a new password is on its way. It expires in one hour.`}
        navLabel="Forgot password navigation"
      >
        <p className="mt-6 text-sm text-ink/55">
          Nothing after a few minutes? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-semibold text-accent hover:underline"
          >
            try a different email
          </button>
          .
        </p>
        <a href="/login" className="mt-8 inline-block text-sm font-semibold text-accent hover:underline">
          ← Back to log in
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password Reset"
      title="Forgot your password?"
      subtitle="Enter the email you signed up with and we'll send you a link to choose a new one."
      error={error}
      navLabel="Forgot password navigation"
    >
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="reset-email" className={authLabelClass}>Email</label>
          <input
            id="reset-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={authInputClass}
          />
        </div>
        <button type="submit" disabled={loading} className={authSubmitClass}>
          {loading ? 'Sending...' : 'Send reset link →'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/55">
        Remembered it? <a href="/login" className="font-semibold text-accent hover:underline">Log in</a>
      </p>
      <p className="mt-2 text-xs text-ink/40">
        Signed up with Google or Strava? Use that button on the login page — those accounts have no password.
      </p>
    </AuthShell>
  );
}
