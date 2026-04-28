export default function ProtocolComplianceRing({ value = 0, size = 82, strokeWidth = 8, label = 'Compliance' }) {
  const normalized = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#ece5db"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#b8752a"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-base font-semibold text-ink">{normalized}%</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink/45">{label}</div>
      </div>
    </div>
  );
}
