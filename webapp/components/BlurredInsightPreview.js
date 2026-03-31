/**
 * BlurredInsightPreview
 *
 * Renders a blurred/locked version of an insight card for free-tier users,
 * with a clear upgrade CTA overlay. This is the primary free → paid
 * conversion mechanism in the app.
 *
 * Usage:
 *   <BlurredInsightPreview
 *     title="Your N=1 Pattern Analysis"
 *     body="After 15+ logs, UltraOS will tell you which interventions most reliably improve your training quality."
 *     exampleStat="+2.1 pts legs feel"
 *     exampleLabel="after sauna sessions"
 *   />
 */
export default function BlurredInsightPreview({
  title = 'Pattern Analysis Unlocked',
  body = 'Log enough data and UltraOS will show you which interventions are actually moving your training quality.',
  exampleStat = '+2.1 pts',
  exampleLabel = 'legs feel after sauna sessions',
  usageNote = null,
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-ink/10 bg-white shadow-[0_8px_24px_rgba(19,24,22,0.06)]">

      {/* Blurred content underneath */}
      <div className="select-none p-7" style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">Training Response</p>
        <p className="mt-2 text-lg font-semibold text-ink">{title}</p>
        <p className="mt-3 text-sm leading-7 text-ink/60">{body}</p>
        <div className="mt-4 rounded-[18px] border border-ink/8 bg-paper px-5 py-4 text-center">
          <p className="font-mono text-3xl font-semibold text-accent">{exampleStat}</p>
          <p className="mt-1 text-xs text-ink/50">{exampleLabel}</p>
        </div>
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[28px] bg-white/85 px-6 text-center backdrop-blur-[2px]">
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
          Individual Plan
        </span>
        <p className="mt-3 text-base font-semibold text-ink">Unlock full pattern analysis</p>
        <p className="mt-2 max-w-xs text-xs leading-5 text-ink/55">
          Upgrade to Individual to see your N=1 correlations — which protocols consistently improve your legs feel, energy, and RPE.
        </p>
        {usageNote && (
          <p className="mt-3 text-[11px] text-ink/40">{usageNote}</p>
        )}
        <a
          href="/pricing"
          className="mt-5 rounded-full bg-ink px-6 py-2.5 text-xs font-semibold text-paper shadow-[0_4px_14px_rgba(19,24,22,0.2)] transition hover:opacity-85"
        >
          View Pricing →
        </a>
      </div>
    </div>
  );
}
