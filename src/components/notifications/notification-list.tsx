"use client";

import { useState, useTransition } from "react";
import {
  Bell,
  CheckCheck,
  ClipboardList,
  FileCheck,
  FileText,
  Megaphone,
  BookOpen,
  CalendarClock,
  Bell as BellIcon,
  Info,
  Receipt,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { markReadAction } from "@/app/notifications/actions";
import { notificationTypeLabel } from "@/lib/notification-labels";
import { Button } from "@/components/ui/button";
import type { NotificationView } from "@/services/notifications";
import type { NotificationType } from "@/types/database";

function TimeAgo({ iso, now }: { iso: string; now: number }) {
  const date = new Date(iso);
  const diff = Math.max(0, now - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let label: string;
  if (minutes < 1) label = "just now";
  else if (minutes < 60) label = `${minutes}m ago`;
  else if (hours < 24) label = `${hours}h ago`;
  else if (days < 7) label = `${days}d ago`;
  else label = date.toLocaleDateString([], { day: "numeric", month: "short" });
  return <span title={date.toLocaleString()}>{label}</span>;
}

const typeIcons: Record<NotificationType, typeof Bell> = {
  assignment_due: ClipboardList,
  assignment_graded: FileCheck,
  exam_upcoming: CalendarClock,
  exam_result: FileText,
  new_lesson: BookOpen,
  announcement: Megaphone,
  fee_invoice_issued: Receipt,
  fee_payment_submitted: Receipt,
  fee_payment_approved: ShieldCheck,
  fee_payment_rejected: ShieldX,
  system: Info,
};

export function NotificationList({
  items,
  unreadCount,
  now,
}: {
  items: NotificationView[];
  unreadCount: number;
  now: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (ids?: string[]) => {
    setError(null);
    startTransition(async () => {
      const result = await markReadAction(ids);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "You're all caught up."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || unreadCount === 0}
          onClick={() => run()}
        >
          <CheckCheck className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Marking…" : "Mark all as read"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {items.length === 0 ? (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <BellIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm text-muted-foreground">
            Updates about announcements, assignments and results will land here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {items.map((n) => {
            const Icon = typeIcons[n.type] ?? Info;
            const unread = n.read_at == null;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  disabled={isPending || !unread}
                  onClick={() => run([n.id])}
                  className={`flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors ${
                    unread
                      ? "hover:bg-accent/60"
                      : "opacity-70"
                  }`}
                  aria-label={unread ? `Mark "${n.title}" as read` : undefined}
                >
                  <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                    {unread && (
                      <span
                        className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{n.title}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {notificationTypeLabel(n.type)}
                      </span>
                    </span>
                    {n.message && (
                      <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                        {n.message}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {n.schoolName ? `${n.schoolName} · ` : ""}
                      <TimeAgo iso={n.created_at} now={now} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}