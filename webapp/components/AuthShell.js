import NavMenu from './NavMenu';

/**
 * Shared chrome for the standalone auth screens (login, signup, forgot
 * password, reset password) so a fourth and fifth page did not mean a fourth
 * and fifth copy of the header markup.
 */
export default function AuthShell({ eyebrow, title, subtitle, error, notice, children, navLabel = 'Auth navigation' }) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="sticky top-0 z-50 px-4 pt-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between rounded-full border border-ink/10 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <a href="/" className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">Threshold</a>
            <div className="hidden items-center gap-7 lg:flex">
              <a href="/guide" className="text-sm font-semibold text-ink/65 transition hover:text-ink">How it works</a>
              <a href="/content" className="text-sm font-semibold text-ink/65 transition hover:text-ink">Research</a>
              <a href="/pricing" className="text-sm font-semibold text-ink/65 transition hover:text-ink">Pricing</a>
              <a href="/signup" className="ui-button-primary py-2.5">Sign Up</a>
            </div>
            <NavMenu
              label={navLabel}
              links={[
                { href: '/guide', label: 'How It Works' },
                { href: '/content', label: 'Research' },
                { href: '/pricing', label: 'Pricing' },
              ]}
              primaryLink={{ href: '/signup', label: 'Sign Up' }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-[32px] border border-ink/10 bg-white px-8 py-10 shadow-[0_8px_32px_rgba(19,24,22,0.07)]">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
          ) : null}
          <h1 className="mt-3 text-3xl font-semibold text-ink">{title}</h1>
          {subtitle ? <div className="mt-2 text-sm text-ink/55">{subtitle}</div> : null}

          {error ? (
            <div role="alert" className="mt-6 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div role="status" className="mt-6 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          ) : null}

          {children}
        </div>
      </div>
    </main>
  );
}

export const authInputClass =
  'w-full rounded-[14px] border border-ink/12 bg-paper px-4 py-3 text-sm text-ink placeholder-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

export const authLabelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-ink/50';

export const authSubmitClass =
  'w-full rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper shadow-[0_4px_16px_rgba(19,24,22,0.2)] transition hover:opacity-85 disabled:opacity-50';
