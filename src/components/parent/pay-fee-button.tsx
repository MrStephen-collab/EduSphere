"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startFeePaymentAction } from "@/app/parent/actions";

/**
 * Sends the parent to Paystack for the invoice's outstanding balance.
 *
 * A full-page navigation rather than a router transition, because the parent
 * leaves the app for an external payment page and comes back afterwards.
 */
export function PayFeeButton({
  invoiceId,
  amount,
  label,
}: {
  invoiceId: string;
  amount: number;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    setError(null);
    startTransition(async () => {
      const result = await startFeePaymentAction(invoiceId);
      if (result.ok && result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      } else if (result.ok) {
        setError("We couldn't build the payment link.");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="grid gap-1.5">
      <Button onClick={go} disabled={isPending} size="sm">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="size-4" aria-hidden="true" />
        )}
        {isPending
          ? "Opening checkout…"
          : (label ??
            `Pay ${amount.toLocaleString("en-NG", {
              style: "currency",
              currency: "NGN",
              maximumFractionDigits: 0,
            })}`)}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
