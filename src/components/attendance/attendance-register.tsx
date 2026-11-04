"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Save,
  ShieldCheck,
  Undo2,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { saveAttendanceAction } from "@/app/teacher/actions";
import { ATTENDANCE_STATUSES, attendanceStatusLabels } from "@/lib/attendance-labels";
import type { ClassRegisterEntry } from "@/services/attendance";
import type { AttendanceStatus } from "@/types/database";

const STATUS_META: Record<
  AttendanceStatus,
  { icon: LucideIcon; active: string; chip: string }
> = {
  present: {
    icon: Check,
    active: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  late: {
    icon: Clock,
    active: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  absent: {
    icon: X,
    active: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
    chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  excused: {
    icon: ShieldCheck,
    active: "border-sky-600 bg-sky-600 text-white hover:bg-sky-700",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
};

function initials(name: string | null | undefined): string {
  return (name ?? "Student")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
    <div className="grid gap-3">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <UsersRound className="size-3.5" aria-hidden="true" />
              {entries.length} student{entries.length === 1 ? "" : "s"}
            </span>
            {ATTENDANCE_STATUSES.map((status) => {
              const meta = STATUS_META[status];
              const Icon = meta.icon;
              return (
                <span
                  key={status}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums",
                    meta.chip,
                  )}
                >
                  <Icon className="size-3" aria-hidden="true" />
                  {counts[status]} {attendanceStatusLabels[status].toLowerCase()}
                </span>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={() => markAll("present")}>
            <Check className="mr-1 size-3.5" aria-hidden="true" />
            All present
          </Button>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No students in this class"
          description="Enrol students into this class and they will appear here for the daily register."
        />
      ) : (
        <div className="grid gap-2">
          {entries.map((e) => {
            const current = marks[e.studentId];
            return (
              <div
                key={e.studentId}
                className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border bg-background/60 p-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {initials(e.displayName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.displayName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.admissionNumber}
                      {e.streamName ? ` · ${e.streamName}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {ATTENDANCE_STATUSES.map((status) => {
                    const meta = STATUS_META[status];
                    const Icon = meta.icon;
                    const active = current === status;
                    return (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={active}
                        onClick={() => setStudent(e.studentId, status)}
                        className={cn(
                          "h-8 rounded-full px-2.5 text-xs",
                          active ? meta.active : "hover:bg-muted",
                        )}
                      >
                        <Icon className="mr-1 size-3.5" aria-hidden="true" />
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

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/90 p-2.5 shadow-lg shadow-foreground/5 backdrop-blur lg:bottom-4">
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
        <Button type="button" variant="ghost" onClick={reset}>
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
