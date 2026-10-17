"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarRange, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ANALYTICS_PERIODS,
  ANALYTICS_PERIOD_LABELS,
  type AnalyticsPeriod,
} from "@/lib/analytics-period";

const selectClass =
  "h-9 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AnalyticsFilters({ activeLabel }: { activeLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const period = (searchParams.get("period") ?? "all") as AnalyticsPeriod;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const hasCustom = !!(from || to);

  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const nextFrom = String(data.get("from") ?? "");
        const nextTo = String(data.get("to") ?? "");
        // Custom dates take over from the period; the period stays set as a
        // fallback so clearing the dates lands somewhere sensible.
        apply({
          period: String(data.get("period") ?? "all"),
          from: nextFrom,
          to: nextTo,
        });
      }}
    >
      <div className="grid gap-1.5 sm:col-span-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          Showing {activeLabel}
        </p>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="a-period" className="text-sm font-medium sr-only">
          Period
        </label>
        <select
          id="a-period"
          name="period"
          defaultValue={period}
          className={selectClass}
          disabled={hasCustom}
        >
          {ANALYTICS_PERIODS.map((p) => (
            <option key={p} value={p}>
              {ANALYTICS_PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="a-from" className="text-xs font-medium text-muted-foreground">
          From
        </label>
        <input id="a-from" name="from" type="date" defaultValue={from} className={selectClass} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="a-to" className="text-xs font-medium text-muted-foreground">
          To
        </label>
        <input id="a-to" name="to" type="date" defaultValue={to} className={selectClass} />
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
        {(hasCustom || period !== "all") && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => apply({ period: "all", from: "", to: "" })}
          >
            <X className="mr-1 size-4" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
