import type { TimetableDay } from "@/types/database";

/**
 * The days the grid renders, Monday to Saturday.
 *
 * Lives here rather than in services/timetable.ts for the same reason
 * ATTENDANCE_STATUSES lives in lib/attendance-labels.ts: the editor is a client
 * component, and importing a value out of a service pulls that service's
 * server-only dependencies -- next/headers, the Supabase server client -- into
 * the browser bundle.
 */
export const TIMETABLE_DAYS: readonly TimetableDay[] = [1, 2, 3, 4, 5, 6];

export const DAY_LABELS: Record<TimetableDay, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/**
 * "08:00 - 08:45", from Postgres's "08:00:00". Trimming to five characters is
 * deliberate: a bell time is not a duration and the seconds are noise.
 */
export function formatPeriodTime(start: string, end: string): string {
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
