export default function EmptyStateCard({ title, body, ctaLabel, ctaHref, icon = 'clipboard' }) {
  const iconPath =
    icon === 'network'
      ? 'M4 12h4m8 0h4M12 4v4m0 8v4M7.8 7.8l2.8 2.8m2.8 2.8 2.8 2.8m0-8.4-2.8 2.8m-2.8 2.8-2.8 2.8'
      : icon === 'spark'
        ? 'M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3L12 3Zm6 13 1 2.5L21.5 19 19 20l-1 2.5L17 20l-2.5-1.5L17 18l1-2Zm-12 1 1.2 2.9L10 21l-2.8 1.1L6 25l-1.2-2.9L2 21l2.8-1.1L6 17Z'
        : icon === 'race'
          ? 'M4 19h16M6 16V7l6-3 6 3v9M9 11h6'
          : 'M9 4h6m-7 4h8m-9 4h10m-2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v10a2 2 0 0 1-2 2Z';

  return (
    <div className="ui-card px-8 py-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-light">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="font-display mt-6 text-4xl text-ink">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ink/72">{body}</p>
      {ctaLabel && ctaHref ? (
        <a href={ctaHref} className="ui-button-primary mt-6">
          {ctaLabel}
        </a>
      ) : null}
    </div>
  );
}
