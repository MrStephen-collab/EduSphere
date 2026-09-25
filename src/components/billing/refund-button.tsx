"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refundPaymentAction } from "@/app/platform/actions";

export function RefundPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    if (!window.confirm("Refund this payment? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await refundPaymentAction(paymentId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive"
        disabled={isPending}
        onClick={go}
      >
        <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
        Refund
      </Button>
      {error && <p className="max-w-40 text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}