"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import type { TimetableDay, TimetablePeriod } from "@/types/database";
import type { ActionState } from "@/app/timetable/actions";
import type { TimetableCell, TimetableOption } from "@/services/timetable";
import { DAY_LABELS, TIMETABLE_DAYS, formatPeriodTime } from "@/lib/timetable-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function selectClass() {
  return "h-9 w-full min-w-0 rounded-md border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

type Draft = { subjectId: string; teacherId: string | null };

/**
 * The editable grid, shared by the school and teacher timetables.
 *
 * Saving happens as soon as a pick changes rather than behind a Save button.
 * A timetable is edited cell by cell and the state of every other cell is
 * already committed, so a submit button would mostly be there to be forgotten.
 * A cell that fails reverts to what the database actually holds, which is read
 * back on refresh, so a rejected change is visible rather than silently lost.
 */
export function TimetableEditor({
  classId,
  sessionId,
  periods,
  cells,
  subjectOptions,
  teacherOptions,
  onSave,
  onClear,
  readOnlySubjects = false,
}: {
  classId: string;
  sessionId: string;
  periods: TimetablePeriod[];
  cells: TimetableCell[];
  subjectOptions: TimetableOption[];
  teacherOptions: TimetableOption[];
  onSave: (input: {
    classId: string;
    sessionId: string;
    dayOfWeek: number;
    periodId: string;
    subjectId: string;
    teacherId: string | null;
  }) => Promise<ActionState>;
  onClear: (input: {
    classId: string;
    sessionId: string;
    dayOfWeek: number;
    periodId: string;
  }) => Promise<ActionState>;
  /**
   * A teacher may set the subject but not assign a colleague to it: choosing who
   * teaches a class is the school's decision, and the demo teacher is linked to
   * every class, so leaving it open would let any teacher rewrite the staff
   * allocation for the whole school.
   */
  readOnlySubjects?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const initial: Record<string, Draft> = {};
    for (const cell of cells) {
      initial[`${cell.day}:${cell.periodId}`] = {
        subjectId: cell.subjectId ?? "",
        teacherId: cell.teacherId,
      };
    }
    return initial;
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = (key: string, next: Draft) => {
    const previous = drafts[key];
    setDrafts((current) => ({ ...current, [key]: next }));
    setError(null);
    setPendingKey(key);

    startTransition(async () => {
      const [day, periodId] = key.split(":") as [string, string];
      const result = await onSave({
        classId,
        sessionId,
        dayOfWeek: Number(day),
        periodId,
        subjectId: next.subjectId,
        teacherId: next.teacherId,
      });

      if (!result.ok) {
        // Put the cell back the way it was. The database never changed, so the
        // old value is the truth and the grid should say so.
        setDrafts((current) => {
          const restored = { ...current };
          if (previous) restored[key] = previous;
          else delete restored[key];
          return restored;
        });
        setError(result.error);
      }

      setPendingKey(null);
      router.refresh();
    });
  };

  const clear = (day: TimetableDay, periodId: string) => {
    const key = `${day}:${periodId}`;
    setError(null);
    setPendingKey(key);

    startTransition(async () => {
      const result = await onClear({ classId, sessionId, dayOfWeek: day, periodId });
      if (!result.ok) {
        setError(result.error);
      } else {
        setDrafts((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
      setPendingKey(null);
      router.refresh();
    });
  };

  if (!subjectOptions.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Timetable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This school has no subjects yet. Add subjects before building a timetable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timetable</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick a subject for each period. Changes save as you make them.
          {readOnlySubjects && " Teachers are assigned by a school admin."}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">
            Editable lesson timetable, periods down the side and days across.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-36 px-2 py-2 text-left font-medium">
                Period
              </th>
              {TIMETABLE_DAYS.map((day: TimetableDay) => (
                <th key={day} scope="col" className="px-2 py-2 text-left font-medium">
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => {
              if (period.is_break) {
                return (
                  <tr key={period.id} className="border-t bg-muted/50">
                    <th scope="row" className="px-2 py-2 text-left font-medium text-muted-foreground">
                      {period.name}
                    </th>
                    <td colSpan={TIMETABLE_DAYS.length} className="px-2 py-2 text-muted-foreground">
                      {formatPeriodTime(period.start_time, period.end_time)} — break
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={period.id} className="border-t align-top">
                  <th scope="row" className="px-2 py-2 text-left font-medium">
                    <span className="block">{period.name}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatPeriodTime(period.start_time, period.end_time)}
                    </span>
                  </th>
                  {TIMETABLE_DAYS.map((day: TimetableDay) => {
                    const key = `${day}:${period.id}`;
                    const draft = drafts[key];
                    const busy = pendingKey === key;

                    return (
                      <td key={day} className="px-2 py-2">
                        <div className="relative grid gap-1">
                          <select
                            className={selectClass()}
                            value={draft?.subjectId ?? ""}
                            disabled={busy}
                            aria-label={`Subject for ${DAY_LABELS[day]}, ${period.name}`}
                            onChange={(e) => {
                              const subjectId = e.target.value;
                              if (!subjectId) {
                                clear(day, period.id);
                                return;
                              }
                              commit(key, {
                                subjectId,
                                teacherId: draft?.teacherId ?? null,
                              });
                            }}
                          >
                            <option value="">—</option>
                            {subjectOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          {!readOnlySubjects && (
                            <select
                              className={selectClass()}
                              value={draft?.teacherId ?? ""}
                              disabled={busy || !draft?.subjectId}
                              aria-label={`Teacher for ${DAY_LABELS[day]}, ${period.name}`}
                              onChange={(e) =>
                                commit(key, {
                                  subjectId: draft?.subjectId ?? "",
                                  teacherId: e.target.value || null,
                                })
                              }
                            >
                              <option value="">No teacher</option>
                              {teacherOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}

                          {busy && (
                            <Loader2
                              className="absolute -right-1 -top-1 h-3 w-3 animate-spin text-muted-foreground"
                              aria-hidden
                            />
                          )}

                          {draft?.subjectId && !busy && (
                            <button
                              type="button"
                              onClick={() => clear(day, period.id)}
                              className="absolute -right-1 -top-1 rounded-full bg-card p-0.5 text-muted-foreground hover:text-destructive"
                              aria-label={`Clear ${DAY_LABELS[day]}, ${period.name}`}
                            >
                              <X className="h-3 w-3" aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
