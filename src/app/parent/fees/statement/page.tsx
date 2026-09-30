import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, UsersRound } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getParentChildren, requireParent, resolveChild } from "@/services/parent";
import { getParentFeeStatement } from "@/services/fees";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ChildPicker } from "@/components/parent/child-picker";
import { FeeStatementPaper } from "@/components/parent/fee-statement-paper";
import { PrintButton } from "@/components/report/print-button";

export const metadata: Metadata = {
  title: "Statement of account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ParentFeeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child: childParam } = await searchParams;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("PARENT")) redirect("/dashboard");

  const { schoolId, parentId } = await requireParent();
  const children = await getParentChildren(schoolId, parentId);
  const child = resolveChild(children, childParam);

  if (!child) {
    return (
      <DashboardShell title="Statement of Account" badge="Parent">
        <EmptyState
          icon={UsersRound}
          title="No children linked yet"
          description="Children linked to your account will appear here. Ask your school to link your account."
        />
      </DashboardShell>
    );
  }

  // A child the caller is not linked to resolves to null rather than to an
  // empty statement, so a tampered ?child= cannot produce a confident
  // "you owe nothing" document about somebody else's child.
  const statement = await getParentFeeStatement(child.studentId);

  return (
    <DashboardShell title="Statement of Account" badge="Parent">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/parent/fees" className="inline-flex print:hidden">
              <Button variant="ghost">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to fees
              </Button>
            </Link>
            <ChildPicker options={children} childId={child.studentId} />
          </div>
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
            description="A statement of account could not be produced for this child. Ask your school to check that they are enrolled and that fees have been raised."
          />
        )}
      </div>
    </DashboardShell>
  );
}
