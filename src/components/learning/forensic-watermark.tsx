"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";

/**
 * Forensic watermark for restricted course media.
 *
 * Two layers, because either one alone is weak:
 *
 *  1. A visible, moving label. It drifts between positions on a timer and
 *     carries the viewer's name plus a short id, so a frame grabbed from a
 *     screen recording names whoever was watching.
 *  2. A low-opacity repeat across the whole frame, so a crop of any one region
 *     still carries the identity.
 *
 * Neither layer survives a determined attacker who re-records frame by frame,
 * and neither is meant to: the server-side `video_access_log` row written when
 * the token is minted is the authoritative trail. This makes a leak obvious
 * and attributable rather than trying to make recording impossible.
 */

const POSITIONS = [
  "top-3 left-3",
  "top-3 right-3",
  "bottom-3 left-3",
  "bottom-3 right-3",
  "top-1/2 left-3 -translate-y-1/2",
  "bottom-8 left-1/2 -translate-x-1/2",
] as const;

const ROTATE_MS = 18_000;
const TICK_MS = 30_000;

export type ForensicWatermarkProps = {
  /** Identity string produced by the server, e.g. "Ada Lovelace · 1A2B3C4D". */
  label: string;
  className?: string;
  /** Set false to freeze the label, e.g. while paused for a screenshot. */
  animate?: boolean;
};

export function ForensicWatermark({
  label,
  className,
  animate = true,
}: ForensicWatermarkProps) {
  const [position, setPosition] = useState(0);
  const [stamp, setStamp] = useState<string>("");

  useEffect(() => {
    const render = () =>
      setStamp(
        new Date().toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      );

    render();
    const tick = setInterval(render, TICK_MS);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!animate) return;
    const rotate = setInterval(() => {
      setPosition((current) => (current + 1) % POSITIONS.length);
    }, ROTATE_MS);
    return () => clearInterval(rotate);
  }, [animate]);

  // Resets the drift when the viewer changes so one student never inherits
  // another's marker position. Adjusting during render is the documented
  // pattern for reacting to a prop change, and avoids an extra render pass.
  const [trackedLabel, setTrackedLabel] = useState(label);
  if (trackedLabel !== label) {
    setTrackedLabel(label);
    setPosition(0);
  }

  const tiled = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="select-none whitespace-nowrap text-[10px] font-medium tracking-wide text-white/25"
        >
          {label}
        </span>
      )),
    [label],
  );

  if (!label) return null;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div className="grid h-full grid-cols-2 grid-rows-3 place-items-center opacity-70">
        {tiled}
      </div>

      <div
        className={cn(
          "absolute rounded bg-black/45 px-2 py-1 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-[1px] transition-all duration-700",
          POSITIONS[position],
        )}
      >
        <span className="block">{label}</span>
        {stamp ? <span className="block text-[9px] font-normal opacity-80">{stamp}</span> : null}
      </div>
    </div>
  );
}
