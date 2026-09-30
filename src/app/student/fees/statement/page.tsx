import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { getStudentFeeStatement } from "@/services/fees";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FeeStatementPaper } from "@/components/parent/fee-statement-paper";
import { PrintButton } from "@/components/report/print-button";

export const metadata: Metadata = {
  title: "My statement of account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentFeeStatementPage() {
  // No ?child= here on purpose. A student has exactly one record, so there is
  // nothing to switch between and nothing for a tampered query string to aim at.
  const statement = await getStudentFeeStatement();

  return (
    <DashboardShell title="My Statement of Account" badge="Student">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/student/fees" className="inline-flex print:hidden">
            <Button variant="ghost">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to fees
            </Button>
          </Link>
          {statement && (
            <div className="print:hidden">
              <PrintButton label="Print statement" />
            </div>
          )}
        </div>

        {statement ? (
          <FeeStatementPaper statement={statement} />
        ) : (
          <EmptyState
            icon={FileText}
            title="No statement available"
            description="A statement of account could not be produced for your record. Ask your school to check that you are enrolled and that fees have been raised."
          />
        )}
      </div>
    </DashboardShell>
  );
}
