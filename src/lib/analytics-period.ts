// Date filtering for the school analytics dashboard (spec section 73).
//
// The analytics page reads a period (and an optional custom from/to) from the
// URL and hands it to the service, which narrows the results/answers queries
// by `created_at`. This module turns those URL values into a concrete range and
// a label the page can show, and is pure so the arithmetic can be tested.
//
// A few deliberate choices, so the numbers shown always mean something:
//   * A period with no end means "from this point until now".
//   * A custom range sends `from` to the start of that day and `to` to the very
//     end of it, so picking a single date includes everything recorded that day.
//   * If both a period and valid custom dates are present, the dates win — the
//     more specific request from the person using the page.
//   * Anything unparseable is ignored rather than throwing; a bad URL falls
//     back to the period (and "All time" if there is no period either).

export const ANALYTICS_PERIODS = ["all", "7d", "30d", "90d", "year"] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
};

export type AnalyticsRange = {
  /** ISO timestamp the range starts at, or null for "no lower bound". */
  from: string | null;
  /** ISO timestamp the range ends at, or null for "until now". */
  to: string | null;
  /** Human label for the active range, e.g. "Last 30 days" or "1 Jan 2026 – 31 Mar 2026". */
  label: string;
  /** True when the range came from explicit from/to dates rather than a period. */
  custom: boolean;
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates like 2026-02-31, which Date would roll over.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Validates a raw period value from the URL, defaulting to "all". */
export function parseAnalyticsPeriod(value: string | null | undefined): AnalyticsPeriod {
  return (ANALYTICS_PERIODS as readonly string[]).includes(value ?? "")
    ? (value as AnalyticsPeriod)
    : "all";
}

/** True when a valid custom from/to date is present. */
export function hasCustomRange(filter: {
  from?: string | null;
  to?: string | null;
}): boolean {
  return parseDateOnly(filter.from) != null || parseDateOnly(filter.to) != null;
}

export type AnalyticsFilter = {
  period?: string | null;
  from?: string | null;
  to?: string | null;
};

/**
 * Turns the URL filter into a concrete range + label. Custom dates take
 * precedence over the period, and unparseable input degrades to "All time".
 */
export function resolveAnalyticsRange(
  filter: AnalyticsFilter,
  now: Date = new Date(),
): AnalyticsRange {
  const fromDate = parseDateOnly(filter.from);
  const toDate = parseDateOnly(filter.to);

  if (fromDate || toDate) {
    const from = fromDate ? new Date(fromDate.getTime()).toISOString() : null;
    const to = toDate
      ? new Date(toDate.getTime() + 86_400_000 - 1).toISOString()
      : null;

    let label: string;
    if (fromDate && toDate) label = `${formatDayLabel(fromDate)} – ${formatDayLabel(toDate)}`;
    else if (fromDate) label = `From ${formatDayLabel(fromDate)}`;
    else label = `Until ${formatDayLabel(toDate as Date)}`;

    return { from, to, label, custom: true };
  }

  const period = parseAnalyticsPeriod(filter.period);
  if (period === "all") {
    return { from: null, to: null, label: ANALYTICS_PERIOD_LABELS.all, custom: false };
  }

  if (period === "year") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return {
      from: start.toISOString(),
      to: null,
      label: ANALYTICS_PERIOD_LABELS.year,
      custom: false,
    };
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const start = new Date(now.getTime() - days * 86_400_000);
  return {
    from: start.toISOString(),
    to: null,
    label: ANALYTICS_PERIOD_LABELS[period],
    custom: false,
  };
}
