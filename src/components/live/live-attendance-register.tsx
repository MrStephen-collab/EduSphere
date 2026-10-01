"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceStatus } from "@/types/database";
import type { LiveAttendanceEntry } from "@/services/live";
import { saveLiveAttendanceAction } from "@/app/live/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENDANCE_STATUSES, attendanceStatusLabel } from "@/lib/live-labels";

const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";

/**
 * The register for one live session.
 *
 * Nothing is written until Save. The teacher is marking half a class from memory
 * and a request per select would put a round trip between each keystroke and
 * every failed one would need unwinding.
 */
export function LiveAttendanceRegister({
  sessionId,
  sessionTitle,
  entries,
}: {
  sessionId: string;
  sessionTitle: string;
  entries: LiveAttendanceEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(entries.map((e) => [e.studentId, e.status])),
  );

  if (!entries.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Register — {sessionTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This class has no students on the roll, so there is nobody to mark.
          </p>
        </CardContent>
      </Card>
    );
  }

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveLiveAttendanceAction({
        liveSessionId: sessionId,
        entries: entries.map((e) => ({ studentId: e.studentId, status: marks[e.studentId] ?? null })),
      });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const markAll = (status: AttendanceStatus) => {
    setSaved(false);
    setMarks((current) => ({
      ...Object.fromEntries(Object.entries(current).map(([id]) => [id, status])),
    }));
  };

  const unmarked = entries.filter((e) => !marks[e.studentId]).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register — {sessionTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Who was actually in the room. EduSphere cannot see who joined the call on
          your provider&apos;s platform, so this is a record you keep.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && !error && <p className="text-sm text-muted-foreground">Register saved.</p>}
        {unmarked > 0 && (
          <p className="text-xs text-muted-foreground">
            {unmarked} not marked yet.
          </p>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_STATUSES.map((status) => (
            <Button key={status} size="sm" variant="outline" onClick={() => markAll(status)}>
              Mark all {attendanceStatusLabel(status).toLowerCase()}
            </Button>
          ))}
        </div>

        <ul className="grid gap-2">
          {entries.map((entry) => (
            <li key={entry.studentId} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block">{entry.displayName}</span>
                <span className="block text-xs text-muted-foreground">
                  {entry.admissionNumber}
                </span>
              </span>
              <select
                className={selectClass}
                value={marks[entry.studentId] ?? ""}
                aria-label={`Attendance for ${entry.displayName}`}
                onChange={(e) => {
                  setSaved(false);
                  setMarks((current) => ({
                    ...current,
                    [entry.studentId]: (e.target.value || null) as AttendanceStatus | null,
                  }));
                }}
              >
                <option value="">Not marked</option>
                {ATTENDANCE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {attendanceStatusLabel(status)}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        <div>
          <Button onClick={save} disabled={isPending}>
            Save register
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
