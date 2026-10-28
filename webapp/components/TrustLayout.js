import PublicHeader from './PublicHeader';

export default function TrustLayout({ title, intro, children, updatedLabel = 'Last updated October 1, 2026.' }) {
  return <main className="public-site"><PublicHeader /><div className="mx-auto max-w-3xl px-5 py-10 md:py-16">
    <h1 className="font-display mt-3 text-4xl leading-tight md:text-6xl">{title}</h1>
    <p className="mt-5 text-lg leading-8 text-ink/80">{intro}</p>
    <div className="mt-8 space-y-8 rounded-[28px] border border-ink/10 bg-white p-6 text-base leading-8 text-ink/90 md:p-9">{children}</div>
    <p className="mt-6 text-sm text-ink/70">{updatedLabel}</p>
  </div></main>;
}
