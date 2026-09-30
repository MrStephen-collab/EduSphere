"use client";

import { useEffect, useState } from "react";

function relative(iso: string, now: number): string {
  const seconds = Math.floor((now - Date.parse(iso)) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Renders an absolute timestamp on the server, then upgrades it to "3m ago"
 * after hydration.
 *
 * The clock is read in an effect rather than during render: calling Date.now()
 * while rendering is impure, and a relative time computed on the server would
 * differ from the one the browser computes, which React would report as a
 * hydration mismatch. The absolute text is deterministic, so it matches on both
 * sides and the swap happens immediately afterwards.
 */
export function RelativeTime({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const absolute = new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [label, setLabel] = useState(absolute);

  useEffect(() => {
    const tick = () => setLabel(relative(iso, Date.now()));
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [iso]);

  return (
    <time dateTime={iso} title={absolute} className={className}>
      {label}
    </time>
  );
}
