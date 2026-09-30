"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  replyToComplaintAction,
  setComplaintStatusAction,
} from "@/app/school/actions";
import {
  COMPLAINT_STATUSES,
  complaintCategoryLabel,
  complaintStatusLabel,
} from "@/lib/complaint-labels";
import type { SchoolComplaint } from "@/services/complaints";
import type { ComplaintMessage, ComplaintStatus } from "@/types/database";

const STATUSES = COMPLAINT_STATUSES;

const statusClasses: Record<string, string> = {
  open: "bg-amber-50 text-amber-800 border-amber-500/40",
  in_progress: "bg-sky-50 text-sky-800 border-sky-500/40",
  resolved: "bg-emerald-50 text-emerald-800 border-emerald-500/40",
};

function nativeSelectClass() {
  return "h-8 w-full rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export function ComplaintInbox({
  complaints,
  messages,
  staff,
}: {
  complaints: SchoolComplaint[];
  messages: Record<string, ComplaintMessage[]>;
  staff: { id: string; name: string; role: string }[];
}) {
  if (complaints.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No complaints from parents yet. Anything raised in the parent portal lands here.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {complaints.map((complaint) => (
        <ComplaintRow
          key={complaint.id}
          complaint={complaint}
          messages={messages[complaint.id] ?? []}
          staff={staff}
        />
      ))}
    </div>
  );
}

function ComplaintRow({
  complaint,
  messages,
  staff,
}: {
  complaint: SchoolComplaint;
  messages: ComplaintMessage[];
  staff: { id: string; name: string; role: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");

  function setStatus(status: ComplaintStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setComplaintStatusAction({
        complaintId: complaint.id,
        status,
      });
      if (!result.ok) setError(result.error);
    });
  }

  function assign(assignedTo: string) {
    setError(null);
    startTransition(async () => {
      const result = await setComplaintStatusAction({
        complaintId: complaint.id,
        status: complaint.status,
        assignedTo: assignedTo === "" ? null : assignedTo,
      });
      if (!result.ok) setError(result.error);
    });
  }

  function reply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await replyToComplaintAction({ complaintId: complaint.id, body });
      if (result.ok) setBody("");
      else setError(result.error);
    });
  }

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{complaint.subject}</p>
          <p className="text-xs text-muted-foreground">
            {complaint.raised_by_name} ({complaint.raised_by_role.toLowerCase()}) ·{" "}
            {complaintCategoryLabel(complaint.category)} · raised{" "}
            <RelativeTime iso={complaint.created_at} />
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-xs ${statusClasses[complaint.status] ?? ""}`}
        >
          {complaintStatusLabel(complaint.status)}
        </span>
      </div>

      <ol className="grid gap-1.5">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-md border p-2.5 text-sm ${
              m.is_from_school ? "border-primary/30 bg-primary/5" : "bg-background"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold">
                {m.author_name}
                {m.is_from_school ? " · School" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                <RelativeTime iso={m.created_at} />
              </p>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`status-${complaint.id}`}>
            Status
          </label>
          <select
            id={`status-${complaint.id}`}
            value={complaint.status}
            disabled={isPending}
            onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
            className={nativeSelectClass()}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {complaintStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`assign-${complaint.id}`}>
            Assigned to
          </label>
          <select
            id={`assign-${complaint.id}`}
            value={complaint.assigned_to ?? ""}
            disabled={isPending}
            onChange={(e) => assign(e.target.value)}
            className={nativeSelectClass()}
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role.toLowerCase()})
              </option>
            ))}
          </select>
        </div>

        {complaint.assignedToName && (
          <p className="pb-1.5 text-xs text-muted-foreground">
            With {complaint.assignedToName}
          </p>
        )}
      </div>

      {complaint.status !== "resolved" && (
        <form onSubmit={reply} className="grid gap-2">
          <label className="text-sm font-medium" htmlFor={`reply-${complaint.id}`}>
            Reply to {complaint.raised_by_name}
          </label>
          <textarea
            id={`reply-${complaint.id}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={4000}
            rows={3}
            placeholder="Your reply is sent to the parent and shows as an official response."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              {isPending ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </form>
      )}

      {complaint.status === "resolved" && (
        <p className="text-xs text-muted-foreground">
          Marked resolved. The parent can still read the thread and raise a new complaint if
          the issue returns.
        </p>
      )}
    </div>
  );
}
