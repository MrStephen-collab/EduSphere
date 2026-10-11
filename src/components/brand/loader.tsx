import { cn } from "cn";
import { LogoMark } from "./logo";

type LoaderSize = "sm" | "md" | "lg";
type LoaderVariant = "full" | "inline" | "compact";

const MARK_SIZE: Record<LoaderSize, number> = { sm: 40, md: 56, lg: 72 };
const WORD_SIZE: Record<LoaderSize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

function ProgressBar({
  showProgress,
  progress,
}: {
  showProgress: boolean;
  progress?: number;
}) {
  const indeterminate = typeof progress !== "number";
  return (
    <div
      className="h-1.5 w-48 overflow-hidden rounded-full bg-white/15"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={showProgress && !indeterminate ? Math.round(progress!) : undefined}
    >
      <div
        className={cn(
          "bg-brand-gradient h-full rounded-full",
          showProgress && !indeterminate ? "" : "animate-pulse",
          showProgress && indeterminate && "w-1/3",
        )}
        style={
          showProgress && !indeterminate
            ? { width: `${Math.min(100, Math.max(0, progress!))}%` }
            : undefined
        }
      />
    </div>
  );
}

/**
 * Branded loading system (spec Part M). Uses the real EduSphere mark — never a
 * generic spinner as the only indicator. Respects `prefers-reduced-motion` via
 * the shared animations in globals.css.
 */
export function EduSphereLoader({
  message,
  variant = "full",
  showProgress = false,
  progress,
  size = "md",
}: {
  message?: string;
  variant?: LoaderVariant;
  showProgress?: boolean;
  progress?: number;
  size?: LoaderSize;
}) {
  const mark = (
    <span className="es-loader-in inline-flex">
      <LogoMark size={variant === "compact" ? 28 : MARK_SIZE[size]} theme="light" />
    </span>
  );

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
        <span className="es-orbit-spin inline-flex">
          <LogoMark size={20} theme="light" />
        </span>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
        <span className="sr-only">Loading</span>
      </span>
    );
  }

  const content = (
    <div className="es-loader-in flex flex-col items-center gap-4 text-center">
      {mark}
      <div className="flex flex-col items-center gap-1">
        <span className={cn("font-bold tracking-tight", WORD_SIZE[size])}>
          Edu<span className="text-[#4AC0FF]">Sphere</span>
        </span>
        {message && <span className="text-sm text-white/70">{message}</span>}
      </div>
      {showProgress && <ProgressBar showProgress={showProgress} progress={progress} />}
      <span className="sr-only" role="status" aria-live="polite">
        {message ?? "Loading"}
      </span>
    </div>
  );

  if (variant === "inline") {
    return <div className="grid place-items-center py-16">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#07172A] px-6">
      {content}
    </div>
  );
}
