"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";

/**
 * Session and class pickers for the timetable. Same search-param navigation as
 * the attendance filters: the URL is the state, so a teacher can send a
 * colleague a link to the exact grid they are looking at.
 */
export function TimetableFilters({
  sessions,
  classes,
  sessionId,
  classId,
}: {
  sessions: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  sessionId: string;
  classId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const nav = useCallback(
    (patch: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) sp.set(key, value);
        else sp.delete(key);
      }
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Session
        <select
          className={selectClass}
          value={sessionId}
          onChange={(e) => nav({ session: e.target.value })}
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Class
        <select
          className={selectClass}
          value={classId}
          onChange={(e) => nav({ class: e.target.value })}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
