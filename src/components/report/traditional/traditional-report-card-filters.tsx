"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";

export function TraditionalReportCardFilters({
  classes,
  terms,
  students,
  classId,
  termId,
  studentId,
  showStudent = true,
}: {
  classes: { id: string; name: string }[];
  terms: { id: string; name: string; sessionName: string }[];
  students: { id: string; displayName: string; admissionNumber: string }[];
  classId: string;
  termId: string;
  studentId: string;
  showStudent?: boolean;
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
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Class
        <select
          className={selectClass}
          value={classId}
          onChange={(e) => nav({ class: e.target.value, student: "" })}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Term
        <select
          className={selectClass}
          value={termId}
          onChange={(e) => nav({ term: e.target.value })}
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.sessionName} — {t.name}
            </option>
          ))}
        </select>
      </label>
      {showStudent && (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Student
          <select
            className={selectClass}
            value={studentId}
            onChange={(e) => nav({ student: e.target.value })}
            disabled={students.length === 0}
          >
            {students.length === 0 && <option value="">No students in this class</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} ({s.admissionNumber})
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
