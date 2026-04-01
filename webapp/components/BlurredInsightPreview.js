export default function BlurredInsightPreview({ title = 'Premium insight preview', body, ctaLabel = 'View Pricing' }) {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-ink/10 bg-white shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
      <div className="pointer-events-none select-none blur-[3px]">
        <div className="grid gap-4 p-6 md:grid-cols-3">
          {[
            { label: 'Sauna Recovery', value: '+2.1', sub: 'legs feel' },
            { label: 'Foam Rolling', value: '+1.4', sub: 'energy' },
            { label: 'Cold Immersion', value: '+1.1', sub: 'legs feel' },
          ].map((item) => (
            <div key={item.label} className="rounded-[22px] border border-ink/10 bg-paper p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">{item.label}</p>
              <p className="mt-3 font-mono text-3xl font-semibold text-ink">{item.value}</p>
              <p className="mt-1 text-xs text-ink/50">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/65 p-6 backdrop-blur-[1px]">
        <div className="max-w-md rounded-[28px] border border-ink/10 bg-white p-8 text-center shadow-[0_24px_60px_rgba(19,24,22,0.14)]">
          <p className="text-sm uppercase tracking-[0.22em] text-accent">{title}</p>
          <p className="mt-3 text-xl font-semibold text-ink">Unlock the full signal layer</p>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            {body || 'Upgrade to Individual to unlock full insights, race blueprints, and deeper pattern detection across your training history.'}
          </p>
          <a href="/pricing" className="mt-5 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper">
            {ctaLabel} →
          </a>
        </div>
      </div>
    </div>
  );
}
