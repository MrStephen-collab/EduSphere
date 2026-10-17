"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  appendSuspiciousEvents,
  buildDeviceContext,
  isAttemptFlagged,
  type DeviceInfo,
  type SuspiciousEvent,
  type SuspiciousEventType,
  SUSPICIOUS_EVENT_DEBOUNCE_MS,
} from "@/lib/exam-security";

const REPORT_INTERVAL_MS = 8000;

const emptySubscribe = () => () => {};

// `fullscreenEnabled` is a live platform flag; reading it through
// useSyncExternalStore keeps the server render (false) and the client in step
// without a setState-in-effect cascade.
function readFocusAvailable(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled === true;
}

export type ExamSecurityPayload = {
  deviceInfo: DeviceInfo | null;
  suspiciousActivity: SuspiciousEvent[];
};

/**
 * Browser-level exam integrity controls (spec section 29).
 *
 * Watches for tab switches, focus loss, fullscreen exits and blocked
 * copy/cut/paste/right-click/print/developer-tools attempts while a paper is
 * open. Events are kept in state for the warning banner, pushed to the server
 * on a throttle (the final trail also rides along with the submit payload),
 * and never block the candidate — they are a deterrent and a record, not a
 * lockout. Claiming more than that would be dishonest.
 */
export function useExamProctor({
  active,
  onReport,
}: {
  attemptId: string;
  active: boolean;
  onReport?: (payload: ExamSecurityPayload) => void;
}) {
  const [events, setEvents] = useState<SuspiciousEvent[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const focusAvailable = useSyncExternalStore(emptySubscribe, readFocusAvailable, () => false);

  const deviceRef = useRef<DeviceInfo | null>(null);
  const eventsRef = useRef<SuspiciousEvent[]>(events);
  const lastEventRef = useRef<{ type: SuspiciousEventType; at: number } | null>(null);
  const fullscreenRef = useRef(false);
  const lastReportedCountRef = useRef(0);
  const onReportRef = useRef(onReport);

  useEffect(() => {
    onReportRef.current = onReport;
  }, [onReport]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const record = useCallback((type: SuspiciousEventType, detail?: string) => {
    const now = Date.now();
    const last = lastEventRef.current;
    if (last && last.type === type && now - last.at < SUSPICIOUS_EVENT_DEBOUNCE_MS) return;
    lastEventRef.current = { type, at: now };
    const next: SuspiciousEvent = {
      type,
      at: new Date(now).toISOString(),
      detail: detail ?? null,
    };
    setEvents((prev) => appendSuspiciousEvents(prev, [next]));
  }, []);

  // Device/session information for the trail (spec: "record device/session
  // information"). Captured once, before anything can go wrong.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
    deviceRef.current = buildDeviceContext({
      userAgent: nav.userAgent,
      platform: nav.platform,
      language: nav.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      connection: nav.connection?.effectiveType ?? null,
      screenWidth: window.screen?.width ?? null,
      screenHeight: window.screen?.height ?? null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    });
  }, []);

  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") record("tab_hidden");
    };
    // Blur alone is noisy on mobile, so only count it when the tab is still
    // visible — a focus loss without a tab switch (another window, devtools).
    const onBlur = () => {
      if (document.visibilityState === "visible") record("window_blur");
    };
    const onFullscreenChange = () => {
      const inFocusMode = Boolean(document.fullscreenElement);
      if (fullscreenRef.current && !inFocusMode) {
        record("fullscreen_exit", "Focus mode ended");
      }
      fullscreenRef.current = inFocusMode;
      setFocusMode(inFocusMode);
    };
    const block = (type: SuspiciousEventType) => (e: Event) => {
      e.preventDefault();
      record(type);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "F12" || (mod && e.shiftKey && ["i", "j", "c"].includes(key))) {
        e.preventDefault();
        record("devtools_shortcut", e.key);
        return;
      }
      if (mod && ["p", "s"].includes(key)) {
        e.preventDefault();
        record("print_attempt", e.key);
        return;
      }
      if (mod && ["c", "x", "v"].includes(key)) {
        e.preventDefault();
        record(
          key === "c" ? "copy_attempt" : key === "x" ? "cut_attempt" : "paste_attempt",
        );
      }
    };

    const onContextMenu = block("context_menu");
    const onCopy = block("copy_attempt");
    const onCut = block("cut_attempt");
    const onPaste = block("paste_attempt");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, record]);

  // Throttled push to the server. The report sends the whole (capped) window,
  // and the service merges idempotently, so a retry after a dropped response
  // cannot duplicate the trail.
  useEffect(() => {
    if (!active || events.length === 0) return;
    if (events.length === lastReportedCountRef.current) return;
    const timer = setTimeout(() => {
      if (!deviceRef.current) return;
      lastReportedCountRef.current = eventsRef.current.length;
      onReportRef.current?.({
        deviceInfo: deviceRef.current,
        suspiciousActivity: eventsRef.current,
      });
    }, REPORT_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [active, events]);

  const enterFocusMode = useCallback(async () => {
    if (typeof document === "undefined" || !document.fullscreenEnabled) return false;
    try {
      await document.documentElement.requestFullscreen();
      fullscreenRef.current = true;
      setFocusMode(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const getSecurityPayload = useCallback((): ExamSecurityPayload => ({
    deviceInfo: deviceRef.current,
    suspiciousActivity: eventsRef.current,
  }), []);

  const flagged = useMemo(() => isAttemptFlagged(events), [events]);

  return {
    events,
    eventCount: events.length,
    flagged,
    focusMode,
    focusAvailable,
    enterFocusMode,
    getSecurityPayload,
  };
}
