"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UsersRound } from "lucide-react";

export function ChildPicker({
  options,
  childId,
}: {
  options: { studentId: string; displayName: string }[];
  childId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const nav = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("child", id);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return (
    <label className="grid w-fit gap-1 text-xs font-medium text-muted-foreground print:hidden">
      <span className="flex items-center gap-1">
        <UsersRound className="size-3.5" aria-hidden="true" />
        Child
      </span>
      <select
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={childId}
        onChange={(e) => nav(e.target.value)}
      >
        {options.map((c) => (
          <option key={c.studentId} value={c.studentId}>
            {c.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}