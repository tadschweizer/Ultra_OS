export default function CoachingExample({ compact = false }) {
  return <figure className="min-w-0">
    <a href="/images/coaching-session-example.png" target="_blank" rel="noreferrer"
      className="block overflow-hidden rounded-xl border border-ink/15 bg-white"
      aria-label="Enlarge the example session from Threshold">
      <img src="/images/coaching-session-example.png" width="576" height="1110"
        className={`h-auto w-full ${compact ? 'max-h-[30rem] object-cover object-top' : ''}`}
        alt="Threshold session view: a planned 40-minute easy run, completed in 38 minutes over 6.1 km at effort 4 out of 10. The athlete reports heavy legs. The coach replies to keep tomorrow easy and marks the result reviewed."
        loading={compact ? 'eager' : 'lazy'} />
    </a>
    <figcaption className="mt-3 text-sm leading-6 text-ink/80">
      Actual Threshold interface with fictional training data. Select the image to enlarge it.
    </figcaption>
  </figure>;
}
