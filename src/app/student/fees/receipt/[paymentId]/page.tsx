import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Receipt as ReceiptIcon } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getFeeReceipt } from "@/services/fees";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FeeReceiptPaper } from "@/components/parent/fee-receipt-paper";
import { PrintButton } from "@/components/report/print-button";

export const metadata: Metadata = {
  title: "My payment receipt",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentFeeReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  // Null for a payment that is not approved, or one that is not this student's.
  // Both read the same to the caller -- "there is no receipt for you" -- because
  // RLS decides which rows exist for this login and an unapproved payment has
  // moved no money to receipt.
  const receipt = await getFeeReceipt(paymentId);

  return (
    <DashboardShell title="Payment Receipt" badge="Student">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href="/student/fees" className="inline-flex">
            <Button variant="ghost">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to fees
            </Button>
          </Link>
          {receipt && <PrintButton label="Print receipt" />}
        </div>

        {receipt ? (
          <FeeReceiptPaper receipt={receipt} />
        ) : (
          <EmptyState
            icon={ReceiptIcon}
            title="No receipt available"
            description="A receipt is available once the school has approved the payment. Payments still awaiting approval do not have one yet."
          />
        )}
      </div>
    </DashboardShell>
  );
}
