"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { complaintCategoryOptions } from "@/lib/complaint-labels";
import type { ComplaintCategory } from "@/types/database";
import { raiseComplaintAction } from "@/app/parent/actions";

export function ComplaintComposer() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("academics");
  const [body, setBody] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await raiseComplaintAction({ subject, category, body });
      if (result.ok) {
        setSent(true);
        setSubject("");
        setBody("");
        setCategory("academics");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="complaint-category" className="text-sm font-medium">
          What is it about?
        </label>
        <select
          id="complaint-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {complaintCategoryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="complaint-subject" className="text-sm font-medium">
          Subject
        </label>
        <input
          id="complaint-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={4}
          maxLength={160}
          placeholder="One line summarising the issue"
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="complaint-body" className="text-sm font-medium">
          Details
        </label>
        <textarea
          id="complaint-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          placeholder="Tell the school what happened, and what you would like done."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          The school&apos;s administrators will see this and can reply. Only you and the
          school can read the conversation.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {sent && (
        <p className="text-sm text-emerald-700">
          Sent. The school has been notified and you can follow the reply below.
        </p>
      )}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {isPending ? "Sending…" : "Send to school"}
        </Button>
      </div>
    </form>
  );
}
