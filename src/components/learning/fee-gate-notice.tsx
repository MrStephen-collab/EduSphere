import Link from "next/link";
import { CheckCircle2, Lock, Wallet } from "lucide-react";
import type { LearningAccessDecision } from "@/lib/fee-gate";
import { describeAccessBlock } from "@/lib/fee-gate";
import { Button } from "@/components/ui/button";

/**
 * Tells a student where they stand with their school's fee gate.
 *
 * Renders nothing when the school has the gate off, so the overwhelming majority
 * of schools never see this at all. When the gate is on it renders either state:
 * a student who has paid enough is told their materials are open, because a
 * family paying in instalments should not have to guess whether the last payment
 * landed, and one who has not is told the exact shortfall rather than a vague
 * "settle your fees".
 */
export function FeeGateNotice({
  access,
  className,
}: {
  access: LearningAccessDecision;
  className?: string;
}) {
  if (!access.gateActive) return null;

  if (access.allowed) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary ${className ?? ""}`}
      >
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Your fees are on track. All materials are open to you.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm ${className ?? ""}`}
    >
      <p className="flex items-start gap-2 font-medium text-amber-700 dark:text-amber-400">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{describeAccessBlock(access)}</span>
      </p>
      <Link href="/student/fees" className="inline-flex">
        <Button size="sm" variant="outline">
          <Wallet className="size-4" aria-hidden="true" />
          Go to fees
        </Button>
      </Link>
    </div>
  );
}
