export default function TrustLayout({ title, intro, children }) {
  return <main className="mx-auto max-w-3xl px-5 py-10 md:py-16">
    <a href="/" className="font-display text-2xl font-semibold text-ink">Threshold</a>
    <p className="mt-8 text-sm font-semibold uppercase tracking-widest text-ink/70">Trust and support</p>
    <h1 className="font-display mt-3 text-4xl leading-tight md:text-6xl">{title}</h1>
    <p className="mt-5 text-lg leading-8 text-ink/80">{intro}</p>
    <div className="mt-8 space-y-8 rounded-[28px] border border-ink/10 bg-white p-6 text-base leading-8 text-ink/90 md:p-9">{children}</div>
    <p className="mt-6 text-sm text-ink/70">Last updated October 1, 2026.</p>
  </main>;
}
