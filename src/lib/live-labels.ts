import type { AttendanceStatus, LiveSessionStatus } from "@/types/database";

export const LIVE_SESSION_STATUS_LABEL: Record<LiveSessionStatus, string> = {
  scheduled: "Scheduled",
  live: "Live now",
  ended: "Ended",
  cancelled: "Cancelled",
};

/**
 * Whether a session is happening right now, allowing for the teacher who pressed
 * "end" a moment ago and for one who has not pressed it yet.
 *
 * Takes the clock as an argument rather than reading it: this is called during
 * render, and a component that reads the wall clock itself is neither pure nor
 * reproducible between the server pass and the browser's.
 */
export function isLiveNow(
  status: LiveSessionStatus,
  startsAt: string,
  endsAt: string | null,
  now: Date,
): boolean {
  if (status === "cancelled") return false;
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : null;
  return now.getTime() >= start && (end === null || now.getTime() < end);
}

/**
 * The host of a join link, so the page can say where a student is about to be
 * sent. EduSphere cannot tell a Google Meet room from a Zoom one -- both are an
 * opaque https URL -- and guessing would be worse than admitting it.
 */
export function joinHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Only http(s) links are allowed. A "join" link that runs javascript: is either
 * a typo or an attempt at the student who clicks it, and it is cheaper to
 * refuse it at the form than to reason about it in the browser.
 */
export function isAcceptableJoinUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "present",
  "late",
  "absent",
  "excused",
];

export function attendanceStatusLabel(status: AttendanceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
