"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewFeePaymentAction } from "@/app/school/actions";
import { formatNaira } from "@/lib/fee-labels";

/**
 * The approval control for one submitted payment.
 *
 * Rejection asks for a reason because the parent is shown the note, so a bare
 * rejection would leave them with nothing to act on. Approving does not require
 * a note; the server clamps anything above the outstanding balance and reports
 * the surplus back in the result message.
 */
export function FeeReviewRow({
  paymentId,
  studentName,
  description,
  attempted,
  currency,
}: {
  paymentId: string;
  studentName: string;
  description: string;
  attempted: number;
  currency: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const decide = (decision: "approve" | "reject") => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await reviewFeePaymentAction({
        paymentId,
        decision,
        note: note.trim() || null,
      });
      if (res.ok) {
        if (res.message) setResult(res.message);
        setNote("");
        setRejecting(false);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <span className="text-sm font-medium">{studentName}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        <span className="font-semibold">{formatNaira(attempted, currency)}</span>
      </div>

      {rejecting ? (
        <div className="grid gap-2">
          <label className="grid gap-1 text-xs font-medium" htmlFor={`note-${paymentId}`}>
            Reason for rejecting
          </label>
          <textarea
            id={`note-${paymentId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="The parent sees this, so be specific."
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={() => decide("approve")}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              Approve anyway
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => decide("reject")}
            >
              <X className="size-4" aria-hidden="true" />
              Confirm rejection
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setRejecting(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={isPending} onClick={() => decide("approve")}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setRejecting(true)}
          >
            <X className="size-4" aria-hidden="true" />
            Reject
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {result && <p className="text-xs text-emerald-700">{result}</p>}
    </div>
  );
}
