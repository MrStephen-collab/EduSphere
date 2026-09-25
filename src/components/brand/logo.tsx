import { useId } from "react";

const BRAND_LIGHT = "#0B7BFF";
const BRAND_DARK = "#032E8E";
const BRAND_ACCENT = "#FE9B06";

export function EduSphereLogo({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const gid = `es-bg-${id}`;
  const maskId = `es-mask-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      focusable="false"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient
          id={gid}
          x1="0"
          y1="0"
          x2="24"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={BRAND_LIGHT} />
          <stop offset="1" stopColor={BRAND_DARK} />
        </linearGradient>
        <mask id={maskId}>
          <rect width="48" height="48" fill="white" />
          <g fill="black">
            <path d="M24 14.4 35.8 19.3 24 24.2 12.2 19.3 Z" />
            <path d="M15.3 21.6 h17.4 v4.5 c0 3.9 -3.8 6.4 -8.7 6.4 s-8.7 -2.5 -8.7 -6.4 Z" />
          </g>
        </mask>
      </defs>

      <rect
        width="48"
        height="48"
        rx="13"
        fill={`url(#${gid})`}
        mask={`url(#${maskId})`}
      />
      <rect
        x="0.75"
        y="0.75"
        width="46.5"
        height="46.5"
        rx="12.25"
        stroke="rgba(255, 255, 255, 0.22)"
        strokeWidth="1.5"
      />
      <path
        d="M35.8 19.3 q2.4 1.2 3.2 3.1"
        stroke={BRAND_ACCENT}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="38.7" cy="23.6" r="1.75" fill={BRAND_ACCENT} />
    </svg>
  );
}

export { BRAND_LIGHT, BRAND_DARK, BRAND_ACCENT };