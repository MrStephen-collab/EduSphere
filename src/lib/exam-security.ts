import { z } from "zod";

/**
 * Browser-level exam integrity controls (spec section 29).
 *
 * These are reasonable deterrents and an evidence trail — not proof of
 * cheating, and the UI must never claim otherwise. Everything here is pure and
 * client-safe: the practice quiz records events, the service role is the only
 * writer, and a teacher sees the trail next to the marks.
 */

export const MAX_SUSPICIOUS_EVENTS = 40;
export const FLAGGED_AFTER_EVENTS = 3;
export const SUSPICIOUS_EVENT_DEBOUNCE_MS = 1500;

export type SuspiciousEventType =
  | "tab_hidden"
  | "window_blur"
  | "fullscreen_exit"
  | "copy_attempt"
  | "cut_attempt"
  | "paste_attempt"
  | "context_menu"
  | "print_attempt"
  | "devtools_shortcut";

export type SuspiciousEvent = {
  type: SuspiciousEventType;
  at: string;
  detail?: string | null;
};

export const SUSPICIOUS_EVENT_TYPES: SuspiciousEventType[] = [
  "tab_hidden",
  "window_blur",
  "fullscreen_exit",
  "copy_attempt",
  "cut_attempt",
  "paste_attempt",
  "context_menu",
  "print_attempt",
  "devtools_shortcut",
];

export const suspiciousEventLabels: Record<SuspiciousEventType, string> = {
  tab_hidden: "Left the exam tab",
  window_blur: "Exam window lost focus",
  fullscreen_exit: "Left focus (fullscreen) mode",
  copy_attempt: "Tried to copy",
  cut_attempt: "Tried to cut",
  paste_attempt: "Tried to paste",
  context_menu: "Opened the right-click menu",
  print_attempt: "Tried to print or save the page",
  devtools_shortcut: "Pressed a developer-tools shortcut",
};

export const suspiciousEventTypeSchema = z.enum(SUSPICIOUS_EVENT_TYPES);

export const suspiciousEventSchema = z.object({
  type: suspiciousEventTypeSchema,
  at: z.string().trim().min(20).max(40),
  detail: z.string().trim().max(160).optional().nullable(),
});

/** Hard intake cap before events are trimmed to the stored maximum. */
export const suspiciousActivitySchema = z
  .array(suspiciousEventSchema)
  .max(MAX_SUSPICIOUS_EVENTS * 10)
  .optional()
  .nullable();

export type DeviceInfo = {
  userAgent: string | null;
  platform: string | null;
  language: string | null;
  timezone: string | null;
  connection: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  devicePixelRatio: number | null;
};

const nullableClampedInt = (max: number) =>
  z.coerce.number().int().min(0).max(max).optional().nullable();

export const deviceInfoSchema = z
  .object({
    userAgent: z.string().trim().max(300).optional().nullable(),
    platform: z.string().trim().max(120).optional().nullable(),
    language: z.string().trim().max(40).optional().nullable(),
    timezone: z.string().trim().max(60).optional().nullable(),
    connection: z.string().trim().max(40).optional().nullable(),
    screenWidth: nullableClampedInt(20000),
    screenHeight: nullableClampedInt(20000),
    viewportWidth: nullableClampedInt(20000),
    viewportHeight: nullableClampedInt(20000),
    devicePixelRatio: z.coerce.number().min(0).max(10).optional().nullable(),
  })
  .optional()
  .nullable();

function truncate(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clampInt(value: number | null | undefined, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.round(value), 0), max);
}

export function buildDeviceContext(input: {
  userAgent?: string | null;
  platform?: string | null;
  language?: string | null;
  timezone?: string | null;
  connection?: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  devicePixelRatio?: number | null;
}): DeviceInfo {
  return {
    userAgent: truncate(input.userAgent, 300),
    platform: truncate(input.platform, 120),
    language: truncate(input.language, 40),
    timezone: truncate(input.timezone, 60),
    connection: truncate(input.connection, 40),
    screenWidth: clampInt(input.screenWidth, 20000),
    screenHeight: clampInt(input.screenHeight, 20000),
    viewportWidth: clampInt(input.viewportWidth, 20000),
    viewportHeight: clampInt(input.viewportHeight, 20000),
    devicePixelRatio:
      typeof input.devicePixelRatio === "number" && Number.isFinite(input.devicePixelRatio)
        ? Math.min(Math.max(input.devicePixelRatio, 0), 10)
        : null,
  };
}

function eventKey(event: SuspiciousEvent): string {
  return `${event.type}|${event.at}`;
}

/**
 * Merge incoming events into whatever the attempt already holds: exact
 * duplicates (same type and timestamp) are dropped, the list stays in
 * chronological order, and only the newest `max` events survive — so a client
 * that spams reports cannot grow the column without bound, and re-reporting
 * the same window of events is idempotent.
 */
export function appendSuspiciousEvents(
  existing: SuspiciousEvent[],
  incoming: SuspiciousEvent[],
  max: number = MAX_SUSPICIOUS_EVENTS,
): SuspiciousEvent[] {
  const seen = new Set<string>();
  const merged: SuspiciousEvent[] = [];
  for (const event of [...existing, ...incoming]) {
    if (!event || typeof event.type !== "string" || typeof event.at !== "string") continue;
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(event);
  }
  merged.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  if (merged.length <= max) return merged;
  return merged.slice(merged.length - max);
}

export type SuspiciousActivitySummary = {
  total: number;
  flagged: boolean;
  counts: Partial<Record<SuspiciousEventType, number>>;
  tabSwitches: number;
};

export function summarizeSuspiciousActivity(
  events: SuspiciousEvent[] | null | undefined,
): SuspiciousActivitySummary {
  const list = Array.isArray(events) ? events : [];
  const counts: Partial<Record<SuspiciousEventType, number>> = {};
  for (const event of list) {
    if (!event || typeof event.type !== "string") continue;
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  return {
    total,
    flagged: total >= FLAGGED_AFTER_EVENTS,
    counts,
    tabSwitches: counts.tab_hidden ?? 0,
  };
}

export function isAttemptFlagged(events: SuspiciousEvent[] | null | undefined): boolean {
  return summarizeSuspiciousActivity(events).flagged;
}

function browserFromUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) return "Opera";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  if (/chrome\//i.test(userAgent)) return "Chrome";
  if (/safari\//i.test(userAgent)) return "Safari";
  return null;
}

function platformFromUserAgent(userAgent: string | null, platform: string | null): string | null {
  const hay = `${userAgent ?? ""} ${platform ?? ""}`;
  if (/android/i.test(hay)) return "Android";
  if (/iphone|ipad|ipod/i.test(hay)) return "iOS";
  if (/windows/i.test(hay)) return "Windows";
  if (/mac os x|macintosh/i.test(hay)) return "macOS";
  if (/linux/i.test(hay)) return "Linux";
  return truncate(platform, 40);
}

/** A short human line like "Chrome on Android · 390×844" for the teacher view. */
export function deviceInfoSummary(info: Partial<DeviceInfo> | null | undefined): string | null {
  if (!info) return null;
  const browser = browserFromUserAgent(info.userAgent ?? null);
  const platform = platformFromUserAgent(info.userAgent ?? null, info.platform ?? null);
  const head =
    browser && platform
      ? `${browser} on ${platform}`
      : browser ?? platform ?? (info.language ? `${info.language} browser` : null);
  const width = info.viewportWidth ?? info.screenWidth;
  const height = info.viewportHeight ?? info.screenHeight;
  const size =
    typeof width === "number" && typeof height === "number" && width > 0 && height > 0
      ? `${width}×${height}`
      : null;
  if (head && size) return `${head} · ${size}`;
  return head ?? size;
}
