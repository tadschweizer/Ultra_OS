export default function FeatureComingSoon({ title, message = 'Coming soon.' }) {
  return (
    <div className="ui-card text-ink">
      <p className="ui-eyebrow">{title}</p>
      <p className="mt-4 text-base font-semibold text-ink/82">{message}</p>
    </div>
  );
}
