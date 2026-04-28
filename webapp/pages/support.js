import NavMenu from '../components/NavMenu';

const publicLinks = [
  { href: '/guide', label: 'How It Works' },
  { href: '/content', label: 'Research' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/support', label: 'Support' },
];

const supportItems = [
  {
    title: 'Login and account access',
    body: 'Use the login portal to access your Threshold account, reconnect Strava, update profile details, or manage billing.',
    href: '/login',
    label: 'Open Login Portal',
  },
  {
    title: 'Technical support',
    body: 'For integration issues, activity sync problems, account access, or API partner questions, contact Threshold support.',
    href: 'mailto:support@mythreshold.co',
    label: 'Email Support',
  },
  {
    title: 'Activity integrations',
    body: 'Strava is available now. Garmin and COROS API access is in progress, and new providers will be added after official approval and testing.',
    href: '/connections',
    label: 'View Connections',
  },
];

export default function Support() {
  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
          <a href="/" className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
            Threshold
          </a>
          <NavMenu
            label="Support navigation"
            links={publicLinks}
            primaryLink={{ href: '/login', label: 'Login' }}
          />
        </div>

        <section className="overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] px-6 py-14 md:px-12 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
            Support Center
          </p>
          <h1 className="font-display mt-5 max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
            Help with login, integrations, and Threshold account access.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/70">
            Use this page to access the app, request technical support, or get help with connected training sources.
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {supportItems.map((item) => (
            <article key={item.title} className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <h2 className="text-xl font-semibold text-ink">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink/65">{item.body}</p>
              <a
                href={item.href}
                className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:opacity-85"
              >
                {item.label}
              </a>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[28px] border border-ink/10 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Partner integration requirement
          </p>
          <p className="mt-3 text-sm leading-7 text-ink/70">
            Threshold maintains a public login portal and support page so users can access connected integrations
            and request technical support.
          </p>
        </section>
      </div>
    </main>
  );
}
