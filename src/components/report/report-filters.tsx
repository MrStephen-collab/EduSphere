"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SessionScope = {
  id: string;
  name: string;
  isCurrent: boolean;
  terms: { id: string; name: string; isCurrent: boolean }[];
};

const selectClass =
  "h-9 rounded-md border bg-background px-3 text-sm";

function pickDefaultTerm(session: SessionScope | undefined): string {
  return (
    session?.terms.find((t) => t.isCurrent)?.id ??
    session?.terms[0]?.id ??
    ""
  );
}

export function ReportFilters({
  sessions,
  classes,
  sessionId,
  termId,
  classId,
  view,
}: {
  sessions: SessionScope[];
  classes?: { id: string; name: string }[];
  sessionId?: string;
  termId?: string;
  classId?: string;
  view?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const session =
    sessions.find((s) => s.id === sessionId) ?? sessions[0];
  const terms = session?.terms ?? [];
  const selectedTerm =
    termId && terms.some((t) => t.id === termId)
      ? termId
      : pickDefaultTerm(session);

  const nav = useCallback(
    (patch: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) sp.set(key, value);
        else sp.delete(key);
      }
      if (view) sp.set("view", view);
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [pathname, router, searchParams, view],
  );

  const chooseClass = (id: string) => nav({ class: id });
  const chooseSession = (id: string) => {
    const next = sessions.find((s) => s.id === id);
    nav({ session: id, term: pickDefaultTerm(next) });
  };
  const chooseTerm = (id: string) => nav({ term: id, session: session?.id ?? "" });

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      {classes && classes.length > 0 && (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Class
          <select
            className={selectClass}
            value={classId ?? classes[0].id}
            onChange={(e) => chooseClass(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {sessions.length > 0 && (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Session
          <select
            className={selectClass}
            value={session?.id ?? ""}
            onChange={(e) => chooseSession(e.target.value)}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {terms.length > 0 && (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Term
          <select
            className={selectClass}
            value={selectedTerm}
            onChange={(e) => chooseTerm(e.target.value)}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}