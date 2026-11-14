/** The macro plate: a plate split into four portions, one per macro. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="20" fill="var(--accent-soft)" />
      <g fill="none" strokeWidth="12" transform="rotate(-90 40 40)">
        <circle cx="40" cy="40" r="24" stroke="#E2603A" strokeDasharray="53.5 150.8" />
        <circle cx="40" cy="40" r="24" stroke="#E0A22B" strokeDasharray="37 150.8" strokeDashoffset="-58" />
        <circle cx="40" cy="40" r="24" stroke="#4F78D1" strokeDasharray="26 150.8" strokeDashoffset="-99.500" />
        <circle cx="40" cy="40" r="24" stroke="#B9508F" strokeDasharray="16 150.8" strokeDashoffset="-130" />
      </g>
    </svg>
  );
}
