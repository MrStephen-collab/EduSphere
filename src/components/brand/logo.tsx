import { useId } from "react";
import { cn } from "cn";

export const ES_COLORS = {
  deep: "#123B8E",
  secondary: "#1677E8",
  bright: "#19A7F2",
  gold: "#F5A900",
  orange: "#FF7A00",
  green: "#19B65A",
  white: "#FFFFFF",
} as const;

export const BRAND_LIGHT = ES_COLORS.secondary;
export const BRAND_DARK = ES_COLORS.deep;
export const BRAND_ACCENT = ES_COLORS.gold;

export type LogoVariant = "full" | "standard" | "icon";
export type LogoTheme = "light" | "dark" | "auto";
export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const SYMBOL_PX: Record<LogoSize, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};
const WORD_PX: Record<LogoSize, number> = {
  xs: 13,
  sm: 17,
  md: 21,
  lg: 28,
  xl: 38,
};
const TAG_PX: Record<LogoSize, number> = {
  xs: 8.5,
  sm: 10.5,
  md: 12,
  lg: 14,
  xl: 17,
};

export const BRAND_TAGLINE = "Your School. Your Students. Your Digital Classroom.";
export const BRAND_LABEL = "EduSphere — Digital Learning Platform";

function toPx(size: LogoSize | number, table: Record<LogoSize, number>) {
  return typeof size === "number" ? size : table[size];
}

export function LogoMark({
  size = 36,
  theme = "auto",
  animated = false,
  className,
}: {
  size?: LogoSize | number;
  theme?: LogoTheme;
  animated?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const sphereId = `es-sphere-${id}`;

  const dark = theme === "dark";
  const sphereFrom = dark ? ES_COLORS.bright : ES_COLORS.secondary;
  const sphereTo = dark ? ES_COLORS.secondary : ES_COLORS.deep;
  const pixelBlue = dark ? "#4AC0FF" : ES_COLORS.bright;

  return (
    <svg
      width={toPx(size, SYMBOL_PX)}
      height={toPx(size, SYMBOL_PX)}
      viewBox="-3 -3 70 70"
      fill="none"
      focusable="false"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={sphereId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={sphereFrom} />
          <stop offset="1" stopColor={sphereTo} />
        </linearGradient>
      </defs>

      <g
        className={cn(animated && "es-orbit-spin")}
        fill="none"
        stroke={ES_COLORS.bright}
        strokeWidth="3"
        strokeLinecap="round"
      >
        <ellipse cx="32" cy="36" rx="27.5" ry="9.5" transform="rotate(-22 32 36)" />
      </g>
      <circle cx="32" cy="36" r="21" fill={`url(#${sphereId})`} />
      <g
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.3"
      >
        <path d="M14.5 28 Q13.5 36 15 47" />
        <path d="M49.5 28 Q50.5 36 49 47" />
      </g>
      <g fill="#FFFFFF">
        <path d="M21.5 19 L40 19 L37.4 21.8 H24.1 Z" strokeLinejoin="round" />
        <rect x="27.2" y="21.8" width="9.6" height="4.2" rx="2.1" />
      </g>
      <path
        d="M39.6 19.6 Q45.5 17.5 48 21"
        fill="none"
        stroke={ES_COLORS.gold}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="48.2" cy="21.6" r="1.4" fill={ES_COLORS.gold} />
      <g
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.5 33.5 Q26.5 41 32 42" />
        <path d="M43.5 33.5 Q37.5 41 32 42" />
        <path d="M32 42 V46" />
        <path d="M20.5 33.5 V37.5 Q26 43.8 32 44.2" opacity="0.45" />
        <path d="M43.5 33.5 V37.5 Q38 43.8 32 44.2" opacity="0.45" />
      </g>
      <rect
        className={cn(animated && "es-pixel")}
        style={{ animationDelay: animated ? "0.15s" : undefined }}
        x="50"
        y="4.5"
        width="6"
        height="6"
        rx="2"
        fill={ES_COLORS.gold}
      />
      <rect
        className={cn(animated && "es-pixel")}
        style={{ animationDelay: animated ? "0.35s" : undefined }}
        x="57.5"
        y="5"
        width="5.5"
        height="5.5"
        rx="1.8"
        fill={pixelBlue}
      />
      <rect
        className={cn(animated && "es-pixel")}
        style={{ animationDelay: animated ? "0.55s" : undefined }}
        x="52.5"
        y="13.5"
        width="5"
        height="5"
        rx="1.7"
        fill={ES_COLORS.green}
      />
    </svg>
  );
}

export function EduSphereLogo({
  variant = "standard",
  theme = "auto",
  size = "md",
  label = BRAND_LABEL,
  className,
}: {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: LogoSize | number;
  label?: string;
  className?: string;
}) {
  if (variant === "icon") {
    return (
      <span
        className={cn("inline-flex shrink-0", className)}
        role="img"
        aria-label={label}
      >
        <LogoMark size={size} theme={theme} />
      </span>
    );
  }

  const dark = theme === "dark";
  const eduClass = dark
    ? "text-white"
    : "text-[#123B8E] dark:text-white";
  const sphereClass =
    theme === "dark"
      ? "from-[#19A7F2] to-[#4AC0FF]"
      : "from-[#1677E8] to-[#19A7F2] dark:from-[#19A7F2] dark:to-[#4AC0FF]";
  const tagClass = dark
    ? "text-[#A3B8D0]"
    : theme === "light"
      ? "text-[#5B6B80]"
      : "text-muted-foreground";

  return (
    <span
      className={cn("flex items-center gap-2.5", className)}
      role="img"
      aria-label={label}
    >
      <LogoMark size={size} theme={theme} />
      <span className="flex flex-col justify-center leading-none">
        <span
          className={cn("whitespace-nowrap font-bold tracking-tight", eduClass)}
          style={{ fontSize: toPx(size, WORD_PX) }}
        >
          Edu
          <span className={cn("bg-linear-to-r bg-clip-text text-transparent", sphereClass)}>
            Sphere
          </span>
        </span>
        {variant === "full" && (
          <span
            className={cn("mt-1 whitespace-nowrap font-medium", tagClass)}
            style={{ fontSize: toPx(size, TAG_PX) }}
          >
            {BRAND_TAGLINE}
          </span>
        )}
      </span>
    </span>
  );
}