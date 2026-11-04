"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const fieldClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-xs transition-colors outline-none hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AttendanceFilters({
  classes,
  classId,
  date,
}: {
  classes: { id: string; name: string }[];
  classId?: string;
  date?: string;
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
      <label className="grid gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Class
        <select
          className={fieldClass}
          value={classId ?? classes[0]?.id ?? ""}
          onChange={(e) => nav({ class: e.target.value, date: date ?? "" })}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Date
        <input
          type="date"
          className={fieldClass}
          value={date ?? ""}
          onChange={(e) => nav({ date: e.target.value })}
        />
      </label>
    </div>
  );
}
