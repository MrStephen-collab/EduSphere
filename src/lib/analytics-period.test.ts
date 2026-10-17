import { describe, expect, it } from "vitest";
import {
  ANALYTICS_PERIODS,
  hasCustomRange,
  parseAnalyticsPeriod,
  resolveAnalyticsRange,
} from "./analytics-period";

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("parseAnalyticsPeriod", () => {
  it("accepts every known period", () => {
    for (const period of ANALYTICS_PERIODS) {
      expect(parseAnalyticsPeriod(period)).toBe(period);
    }
  });

  it("falls back to all time for anything else", () => {
    expect(parseAnalyticsPeriod(undefined)).toBe("all");
    expect(parseAnalyticsPeriod(null)).toBe("all");
    expect(parseAnalyticsPeriod("")).toBe("all");
    expect(parseAnalyticsPeriod("last-decade")).toBe("all");
  });
});

describe("hasCustomRange", () => {
  it("is true only when a usable date is present", () => {
    expect(hasCustomRange({ from: "2026-01-01" })).toBe(true);
    expect(hasCustomRange({ to: "2026-01-01" })).toBe(true);
    expect(hasCustomRange({ from: "nonsense" })).toBe(false);
    expect(hasCustomRange({})).toBe(false);
  });
});

describe("resolveAnalyticsRange", () => {
  it("returns an open range labelled All time with no filters", () => {
    const range = resolveAnalyticsRange({}, NOW);
    expect(range).toEqual({ from: null, to: null, label: "All time", custom: false });
  });

  it("measures day windows back from now", () => {
    expect(resolveAnalyticsRange({ period: "7d" }, NOW).from).toBe(
      new Date("2026-06-08T12:00:00.000Z").toISOString(),
    );
    expect(resolveAnalyticsRange({ period: "30d" }, NOW).from).toBe(
      new Date("2026-05-16T12:00:00.000Z").toISOString(),
    );
    expect(resolveAnalyticsRange({ period: "90d" }, NOW).from).toBe(
      new Date("2026-03-17T12:00:00.000Z").toISOString(),
    );
    expect(resolveAnalyticsRange({ period: "7d" }, NOW).label).toBe("Last 7 days");
  });

  it("starts This year at 1 January", () => {
    const range = resolveAnalyticsRange({ period: "year" }, NOW);
    expect(range.from).toBe(new Date(Date.UTC(2026, 0, 1)).toISOString());
    expect(range.to).toBeNull();
    expect(range.label).toBe("This year");
  });

  it("trims a custom from to the start of its day", () => {
    const range = resolveAnalyticsRange({ from: "2026-01-05" }, NOW);
    expect(range.from).toBe("2026-01-05T00:00:00.000Z");
    expect(range.to).toBeNull();
    expect(range.custom).toBe(true);
    expect(range.label).toBe("From 5 Jan 2026");
  });

  it("rounds a custom to up to the end of its day", () => {
    const range = resolveAnalyticsRange({ to: "2026-01-05" }, NOW);
    expect(range.from).toBeNull();
    expect(range.to).toBe("2026-01-05T23:59:59.999Z");
    expect(range.label).toBe("Until 5 Jan 2026");
  });

  it("labels a full custom range with both ends", () => {
    const range = resolveAnalyticsRange({ from: "2026-01-01", to: "2026-03-31" }, NOW);
    expect(range.from).toBe("2026-01-01T00:00:00.000Z");
    expect(range.to).toBe("2026-03-31T23:59:59.999Z");
    expect(range.label).toBe("1 Jan 2026 – 31 Mar 2026");
  });

  it("prefers custom dates over a period", () => {
    const range = resolveAnalyticsRange(
      { period: "7d", from: "2026-01-01", to: "2026-01-31" },
      NOW,
    );
    expect(range.custom).toBe(true);
    expect(range.from).toBe("2026-01-01T00:00:00.000Z");
  });

  it("ignores an impossible date and falls back to the period", () => {
    const range = resolveAnalyticsRange({ period: "30d", from: "2026-02-31" }, NOW);
    expect(range.custom).toBe(false);
    expect(range.label).toBe("Last 30 days");
  });
});
