import { describe, expect, it } from "vitest";
import {
  FLAGGED_AFTER_EVENTS,
  MAX_SUSPICIOUS_EVENTS,
  appendSuspiciousEvents,
  buildDeviceContext,
  deviceInfoSchema,
  deviceInfoSummary,
  isAttemptFlagged,
  summarizeSuspiciousActivity,
  suspiciousActivitySchema,
  suspiciousEventSchema,
  type SuspiciousEvent,
} from "./exam-security";

const event = (
  type: SuspiciousEvent["type"],
  at: string,
  detail?: string,
): SuspiciousEvent => ({ type, at, detail: detail ?? null });

describe("appendSuspiciousEvents", () => {
  it("merges and sorts by time", () => {
    const merged = appendSuspiciousEvents(
      [event("tab_hidden", "2026-01-01T10:00:05.000Z")],
      [event("copy_attempt", "2026-01-01T10:00:01.000Z")],
    );
    expect(merged.map((e) => e.type)).toEqual(["copy_attempt", "tab_hidden"]);
  });

  it("drops exact duplicates so re-reporting the same window is idempotent", () => {
    const existing = [event("tab_hidden", "2026-01-01T10:00:00.000Z")];
    const merged = appendSuspiciousEvents(existing, [
      event("tab_hidden", "2026-01-01T10:00:00.000Z"),
      event("window_blur", "2026-01-01T10:00:01.000Z"),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.filter((e) => e.type === "tab_hidden")).toHaveLength(1);
  });

  it("keeps only the newest events when over the cap", () => {
    const old = Array.from({ length: MAX_SUSPICIOUS_EVENTS }, (_, i) =>
      event("tab_hidden", `2026-01-01T09:00:${String(i).padStart(2, "0")}.000Z`),
    );
    const merged = appendSuspiciousEvents(old, [
      event("copy_attempt", "2026-01-01T10:00:00.000Z"),
    ]);
    expect(merged).toHaveLength(MAX_SUSPICIOUS_EVENTS);
    expect(merged.at(-1)?.type).toBe("copy_attempt");
    expect(merged[0]?.at).toBe("2026-01-01T09:00:01.000Z");
  });

  it("ignores malformed entries instead of throwing", () => {
    const merged = appendSuspiciousEvents(
      [null as unknown as SuspiciousEvent, event("tab_hidden", "2026-01-01T10:00:00.000Z")],
      [{ type: "nope", at: 12 } as unknown as SuspiciousEvent],
    );
    expect(merged).toHaveLength(1);
  });
});

describe("summarizeSuspiciousActivity", () => {
  it("is safe on null, undefined and empty input", () => {
    for (const input of [null, undefined, []]) {
      const summary = summarizeSuspiciousActivity(input);
      expect(summary.total).toBe(0);
      expect(summary.flagged).toBe(false);
      expect(summary.tabSwitches).toBe(0);
    }
  });

  it("counts each type and flags at the threshold", () => {
    const events = [
      event("tab_hidden", "2026-01-01T10:00:00.000Z"),
      event("tab_hidden", "2026-01-01T10:00:01.000Z"),
      event("copy_attempt", "2026-01-01T10:00:02.000Z"),
    ];
    const summary = summarizeSuspiciousActivity(events);
    expect(summary.total).toBe(3);
    expect(summary.counts.tab_hidden).toBe(2);
    expect(summary.counts.copy_attempt).toBe(1);
    expect(summary.tabSwitches).toBe(2);
    expect(summary.flagged).toBe(FLAGGED_AFTER_EVENTS <= 3);
    expect(isAttemptFlagged(events)).toBe(true);
    expect(isAttemptFlagged(events.slice(0, 2))).toBe(false);
  });
});

describe("buildDeviceContext", () => {
  it("truncates long strings and clamps numbers", () => {
    const info = buildDeviceContext({
      userAgent: "x".repeat(500),
      platform: "y".repeat(200),
      language: "en-NG",
      timezone: "Africa/Lagos",
      connection: "4g",
      screenWidth: -5,
      screenHeight: 99999,
      viewportWidth: 390.6,
      viewportHeight: undefined,
      devicePixelRatio: 99,
    });
    expect(info.userAgent).toHaveLength(300);
    expect(info.platform).toHaveLength(120);
    expect(info.screenWidth).toBe(0);
    expect(info.screenHeight).toBe(20000);
    expect(info.viewportWidth).toBe(391);
    expect(info.viewportHeight).toBeNull();
    expect(info.devicePixelRatio).toBe(10);
  });

  it("nulls out missing and non-finite values", () => {
    const info = buildDeviceContext({
      userAgent: "   ",
      screenWidth: Number.NaN,
      devicePixelRatio: Number.POSITIVE_INFINITY,
    });
    expect(info.userAgent).toBeNull();
    expect(info.screenWidth).toBeNull();
    expect(info.devicePixelRatio).toBeNull();
    expect(info.language).toBeNull();
  });
});

describe("deviceInfoSummary", () => {
  it("names the browser and platform with the viewport", () => {
    expect(
      deviceInfoSummary({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        viewportWidth: 390,
        viewportHeight: 844,
      }),
    ).toBe("Chrome on Android · 390×844");
  });

  it("falls back to the screen size, then to nothing", () => {
    expect(deviceInfoSummary({ screenWidth: 1920, screenHeight: 1080 })).toBe("1920×1080");
    expect(deviceInfoSummary(null)).toBeNull();
    expect(deviceInfoSummary({})).toBeNull();
  });

  it("recognises Edge and Safari before Chrome", () => {
    expect(
      deviceInfoSummary({ userAgent: "Mozilla/5.0 Edg/120.0.0.0 Safari/537.36" }),
    ).toContain("Edge");
    expect(
      deviceInfoSummary({ userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605" }),
    ).toContain("Safari");
  });
});

describe("schemas", () => {
  it("accepts a well-formed event and rejects an unknown type", () => {
    expect(
      suspiciousEventSchema.safeParse(event("tab_hidden", "2026-01-01T10:00:00.000Z")).success,
    ).toBe(true);
    expect(
      suspiciousEventSchema.safeParse({ type: "webcam", at: "2026-01-01T10:00:00.000Z" }).success,
    ).toBe(false);
  });

  it("caps the intake list length", () => {
    const many = Array.from({ length: MAX_SUSPICIOUS_EVENTS * 10 + 1 }, (_, i) =>
      event("tab_hidden", `2026-01-01T09:00:00.${String(i).padStart(3, "0")}Z`),
    );
    expect(suspiciousActivitySchema.safeParse(many).success).toBe(false);
    expect(suspiciousActivitySchema.safeParse([]).success).toBe(true);
    expect(suspiciousActivitySchema.safeParse(null).success).toBe(true);
  });

  it("rejects device fields that are out of range or the wrong type", () => {
    expect(deviceInfoSchema.safeParse({ userAgent: "ok", viewportWidth: 390 }).success).toBe(true);
    expect(deviceInfoSchema.safeParse({ viewportWidth: 999999 }).success).toBe(false);
    expect(deviceInfoSchema.safeParse({ language: { nope: true } }).success).toBe(false);
    expect(deviceInfoSchema.safeParse(null).success).toBe(true);
  });
});
