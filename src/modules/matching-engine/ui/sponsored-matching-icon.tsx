import type { SVGProps } from "react";

/**
 * Sponsored Matching brand mark — megaphone + $ coin + broadcast lines.
 * Gradient matches the product asset (lime → cyan).
 */
export function SponsoredMatchingIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  const gid = "sponsored-matching-grad";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id={gid} x1="2" y1="20" x2="22" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22c55e" />
          <stop offset="0.55" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Megaphone body */}
      <path
        d="M9.2 9.1 16.4 5.4a1.2 1.2 0 0 1 1.7 1.1v11a1.2 1.2 0 0 1-1.7 1.1L9.2 14.9"
        stroke={`url(#${gid})`}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 9.1v5.8c0 .9-.7 1.6-1.6 1.6h-.4A2.9 2.9 0 0 1 4.3 13.6v-.2A2.9 2.9 0 0 1 7.2 10.5h.4c.9 0 1.6.7 1.6 1.6Z"
        stroke={`url(#${gid})`}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* $ coin */}
      <circle
        cx="7.1"
        cy="8.1"
        r="2.55"
        stroke={`url(#${gid})`}
        strokeWidth="1.75"
      />
      <path
        d="M7.1 6.7v2.8M6.2 7.35c.2-.35.55-.55.9-.55.7 0 1.1.35 1.1.85s-.4.85-1.1.85c-.7 0-1.1.35-1.1.85s.4.85 1.1.85c.35 0 .7-.2.9-.55"
        stroke={`url(#${gid})`}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Broadcast lines */}
      <path
        d="M19.2 8.2h1.8M19.6 12h2.2M19.2 15.8h1.8"
        stroke={`url(#${gid})`}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
