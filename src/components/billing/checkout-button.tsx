"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startCheckoutAction } from "@/app/school/actions";

export function CheckoutButton({
  planId,
  label,
  disabled = false,
}: {
  planId: string;
  label: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    setError(null);
    startTransition(async () => {
      const result = await startCheckoutAction(planId);
      if (result.ok && result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      } else if (result.ok) {
        setError("We couldn't build the checkout link.");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="grid gap-2">
      <Button disabled={disabled || isPending} onClick={go} className="w-full">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="size-4" aria-hidden="true" />
        )}
        {isPending ? "Opening checkout…" : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}