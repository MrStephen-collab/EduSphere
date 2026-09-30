"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { replyToComplaintAction, withdrawComplaintAction } from "@/app/parent/actions";
import type { ComplaintMessage } from "@/types/database";

export function ComplaintThread({
  complaintId,
  subject,
  status,
  messages,
}: {
  complaintId: string;
  subject: string;
  status: string;
  messages: ComplaintMessage[];
}) {
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);

  const closed = status === "resolved" || withdrawn;

  function reply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await replyToComplaintAction({ complaintId, body });
      if (result.ok) setBody("");
      else setError(result.error);
    });
  }

  function withdraw() {
    if (!window.confirm("Withdraw this complaint? The school will no longer see it.")) return;
    startTransition(async () => {
      const result = await withdrawComplaintAction(complaintId);
      if (result.ok) setWithdrawn(true);
      else setError(result.error);
    });
  }

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{subject}</h3>
        {status === "open" && !withdrawn && (
          <Button variant="ghost" size="sm" disabled={isPending} onClick={withdraw}>
            Withdraw
          </Button>
        )}
      </div>

      {withdrawn && (
        <p className="rounded-md border border-amber-500/40 bg-amber-50 p-2.5 text-sm text-amber-900">
          You withdrew this complaint. The school can no longer see it.
        </p>
      )}

      <ol className="grid gap-2">
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

      {closed ? (
        <p className="text-xs text-muted-foreground">
          {withdrawn
            ? "This complaint was withdrawn."
            : "The school marked this resolved. Raise a new complaint if the issue comes back."}
        </p>
      ) : (
        <form onSubmit={reply} className="grid gap-2">
          <label htmlFor={`reply-${complaintId}`} className="text-sm font-medium">
            Reply to the school
          </label>
          <textarea
            id={`reply-${complaintId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={4000}
            rows={3}
            placeholder="Add more information…"
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
    </div>
  );
}
