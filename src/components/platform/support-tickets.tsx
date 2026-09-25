"use client";

import { useState, useTransition } from "react";
import { setTicketStatusAction } from "@/app/platform/actions";
import type { SupportTicket } from "@/services/platform";

const ticketStatuses = ["open", "in_progress", "resolved", "closed"] as const;

const statusClasses: Record<string, string> = {
  open: "bg-red-500/10 text-red-600 dark:text-red-400",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

function nativeSelectClass() {
  return "h-8 w-full rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

function TicketStatusControl({ ticket }: { ticket: SupportTicket }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-1">
      <select
        aria-label={`Status for ${ticket.subject}`}
        value={ticket.status}
        disabled={isPending}
        onChange={(e) => {
          setError(null);
          const next = e.target.value as (typeof ticketStatuses)[number];
          startTransition(async () => {
            const result = await setTicketStatusAction(ticket.id, next);
            if (!result.ok) setError(result.error);
          });
        }}
        className={nativeSelectClass()}
      >
        {ticketStatuses.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function SupportTicketList({ tickets }: { tickets: SupportTicket[] }) {
  return (
    <ul className="grid gap-3">
      {tickets.map((t) => (
        <li key={t.id} className="rounded-lg border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{t.subject}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusClasses[t.priority] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.priority}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusClasses[t.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                {t.message}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t.schoolName ?? "Platform"} · {t.reporterName ?? "Unknown user"}
                {t.reporterEmail ? ` · ${t.reporterEmail}` : ""}
                {" · "}
                {new Date(t.createdAt).toLocaleString([], {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="sm:w-[180px]">
              <TicketStatusControl ticket={t} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}