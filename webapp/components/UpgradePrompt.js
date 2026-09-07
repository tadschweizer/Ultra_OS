export default function UpgradePrompt({ featureName, unlockTier, body = null }) {
  return (
    <div className="ui-card text-ink">
      <p className="ui-eyebrow">{unlockTier?.includes('Coach') ? 'Closed coach pilot' : 'Plan access'}</p>
      <h2 className="mt-4 text-3xl font-semibold leading-tight">{featureName}</h2>
      <p className="mt-4 text-sm leading-7 text-ink/76">
        {unlockTier?.includes('Coach')
          ? 'Coach access requires administrator approval for the closed pilot or an existing paid Coach plan. Selecting Coach at signup does not activate access. Ask your pilot organizer for approval; no purchase is required for the pilot.'
          : body || `${featureName} unlocks on the ${unlockTier} plan. Coach-linked daily check-ins do not require an athlete upgrade while the qualifying relationship remains active.`}
      </p>
      <a href="/pricing" className="ui-button-primary mt-6">
        View access details
      </a>
    </div>
  );
}
