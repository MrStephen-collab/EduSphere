import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import type { LucideIcon } from "lucide-react";

export type StatTone = "indigo" | "rose" | "amber" | "emerald" | "sky" | "fuchsia";

const toneStyles: Record<
  StatTone,
  { card: string; topBar: string; chip: string; value: string; hover: string }
> = {
  indigo: {
    card: "bg-gradient-to-br from-indigo-500/15 to-indigo-500/5",
    topBar: "from-indigo-500 to-violet-500",
    chip: "bg-gradient-to-br from-indigo-500 to-violet-600",
    value: "from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400",
    hover: "hover:ring-indigo-500/30",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-500/15 to-rose-500/5",
    topBar: "from-rose-500 to-pink-500",
    chip: "bg-gradient-to-br from-rose-500 to-pink-600",
    value: "from-rose-600 to-pink-600 dark:from-rose-400 dark:to-pink-400",
    hover: "hover:ring-rose-500/30",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-500/15 to-amber-500/5",
    topBar: "from-amber-500 to-orange-500",
    chip: "bg-gradient-to-br from-amber-500 to-orange-600",
    value: "from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400",
    hover: "hover:ring-amber-500/30",
  },
  emerald: {
    card: "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5",
    topBar: "from-emerald-500 to-teal-500",
    chip: "bg-gradient-to-br from-emerald-500 to-teal-600",
    value: "from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400",
    hover: "hover:ring-emerald-500/30",
  },
  sky: {
    card: "bg-gradient-to-br from-sky-500/15 to-sky-500/5",
    topBar: "from-sky-500 to-blue-500",
    chip: "bg-gradient-to-br from-sky-500 to-blue-600",
    value: "from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400",
    hover: "hover:ring-sky-500/30",
  },
  fuchsia: {
    card: "bg-gradient-to-br from-fuchsia-500/15 to-fuchsia-500/5",
    topBar: "from-fuchsia-500 to-purple-500",
    chip: "bg-gradient-to-br from-fuchsia-500 to-purple-600",
    value: "from-fuchsia-600 to-purple-600 dark:from-fuchsia-400 dark:to-purple-400",
    hover: "hover:ring-fuchsia-500/30",
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  href,
  tone = "indigo",
  index = 0,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  href?: string;
  tone?: StatTone;
  index?: number;
}) {
  const styles = toneStyles[tone];

  const inner = (
    <div
      className={cn(
        "animate-card-enter relative flex h-full flex-col overflow-hidden rounded-xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10 transition-all duration-300",
        styles.card,
        href && cn("hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/10", styles.hover),
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          styles.topBar,
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md bg-gradient-to-br text-white shadow-sm shadow-foreground/10",
            styles.chip,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </div>
        {href && (
          <ArrowUpRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <div
        className={cn(
          "mt-2.5 bg-gradient-to-r bg-clip-text text-xl font-bold leading-none tracking-tight tabular-nums text-transparent lg:text-2xl",
          styles.value,
        )}
      >
        {value}
      </div>
      <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{title}</div>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full min-w-0">
        {inner}
      </Link>
    );
  }

  return <div className="block h-full min-w-0">{inner}</div>;
}

export function StatCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="animate-card-enter"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="h-24 rounded-xl ring-1 ring-foreground/10">
        <div className="skeleton h-full w-full rounded-xl" />
      </div>
    </div>
  );
}