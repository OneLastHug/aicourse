/**
 * Repo2Learn brand mark — an amber tile with three ascending bars (a layered,
 * 0→1 learning path). Kept byte-identical to site/app/icon.svg so the in-app
 * logo and the browser-tab favicon are the same mark.
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="r2lGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#r2lGrad)" />
      <g fill="#ffffff">
        <rect x="8" y="18" width="4.5" height="7" rx="2.25" />
        <rect x="13.75" y="13" width="4.5" height="12" rx="2.25" />
        <rect x="19.5" y="8" width="4.5" height="17" rx="2.25" />
      </g>
    </svg>
  );
}
