import { cn } from "cn";

const TONES = {
  primary: "bg-primary",
  blue: "bg-blue",
  teal: "bg-teal",
  success: "bg-success",
  violet: "bg-violet",
} as const;

export function ProgressBar({
  value,
  tone = "primary",
  className,
  label,
}: {
  value: number;
  tone?: keyof typeof TONES;
  className?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", TONES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
