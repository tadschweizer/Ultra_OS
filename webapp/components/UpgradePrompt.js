export default function UpgradePrompt({ featureName, unlockTier, body = null }) {
  return (
    <div className="ui-card text-ink">
      <p className="ui-eyebrow">Upgrade Required</p>
      <h2 className="mt-4 text-3xl font-semibold leading-tight">{featureName}</h2>
      <p className="mt-4 text-sm leading-7 text-ink/76">
        {body || `${featureName} unlocks on the ${unlockTier} plan.`}
      </p>
      <a href="/pricing" className="ui-button-primary mt-6">
        View Pricing
      </a>
    </div>
  );
}
