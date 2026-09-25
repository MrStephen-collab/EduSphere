"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveAttendanceAction } from "@/app/teacher/actions";
import { ATTENDANCE_STATUSES, attendanceStatusLabels } from "@/lib/attendance-labels";
import type { ClassRegisterEntry } from "@/services/attendance";
import type { AttendanceStatus } from "@/types/database";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-primary text-primary-foreground",
  late: "bg-amber-500 text-white",
  absent: "bg-destructive text-destructive-foreground",
  excused: "bg-sky-600 text-white",
};

export function AttendanceRegister({
  classId,
  date,
  entries,
}: {
  classId: string;
  date: string;
  entries: ClassRegisterEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    for (const e of entries) initial[e.studentId] = e.status ?? "present";
    return initial;
  });
  const initialMarks = useRef(marks);

  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
  };
  for (const e of entries) counts[marks[e.studentId]] += 1;

  const setStudent = (studentId: string, status: AttendanceStatus) => {
    setSaved(false);
    setMarks((m) => ({ ...m, [studentId]: status }));
  };

  const markAll = (status: AttendanceStatus) => {
    setSaved(false);
    setMarks(() => {
      const next: Record<string, AttendanceStatus> = {};
      for (const e of entries) next[e.studentId] = status;
      return next;
    });
  };

  const reset = () => {
    setSaved(false);
    setMarks({ ...initialMarks.current });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold">{entries.length} student{entries.length === 1 ? "" : "s"}</span>
          <span>
            <span className="font-medium text-emerald-600">{counts.present + counts.late}</span>{" "}
            <span className="text-muted-foreground">present</span>
          </span>
          <span>
            <span className="font-medium text-amber-600">{counts.late}</span>{" "}
            <span className="text-muted-foreground">late</span>
          </span>
          <span>
            <span className="font-medium text-destructive">{counts.absent}</span>{" "}
            <span className="text-muted-foreground">absent</span>
          </span>
          <span>
            <span className="font-medium text-sky-600">{counts.excused}</span>{" "}
            <span className="text-muted-foreground">excused</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => markAll("present")}>
            All present
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No students are enrolled in this class.
        </p>
      ) : (
        <div className="grid gap-2">
          {entries.map((e) => {
            const current = marks[e.studentId];
            return (
              <div
                key={e.studentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3"
              >
                <div className="grid min-w-0">
                  <p className="truncate font-medium">{e.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.admissionNumber}
                    {e.streamName ? ` · Stream ${e.streamName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ATTENDANCE_STATUSES.map((status) => {
                    const active = current === status;
                    return (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={active}
                        onClick={() => setStudent(e.studentId, status)}
                        className={active ? STATUS_STYLES[status] : ""}
                      >
                        {attendanceStatusLabels[status]}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={isPending || entries.length === 0}
          onClick={() => {
            setError(null);
            setSaved(false);
            startTransition(async () => {
              const result = await saveAttendanceAction(
                classId,
                date,
                Object.entries(marks).map(([studentId, status]) => ({
                  studentId,
                  status,
                })),
              );
              if (result.ok) {
                setSaved(true);
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {isPending ? "Saving…" : "Save register"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={reset}
        >
          <Undo2 className="size-4" aria-hidden="true" />
          Reset
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
            Register saved.
          </span>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}