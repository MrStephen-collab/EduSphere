import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileX2 } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getAdmissionLetterData } from "@/services/admissions";
import { canIssueAdmissionLetter } from "@/lib/admission";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { AdmissionLetterPaper } from "@/components/school/admission-letter-paper";
import { PrintButton } from "@/components/report/print-button";

export const metadata: Metadata = {
  title: "Offer letter",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdmissionLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.some((r) => r === "SCHOOL_OWNER" || r === "SCHOOL_ADMIN")) {
    redirect("/school");
  }

  const data = await getAdmissionLetterData(id);
  // Null for an application in another school, or one that does not exist. A
  // letter only exists once the application has been offered a place -- there
  // is nothing to print while it is still under review or was declined.
  const ready = data && canIssueAdmissionLetter(data.application.status);

  return (
    <DashboardShell title="Offer Letter" badge="Admin">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/school/admissions" className="inline-flex">
            <Button variant="ghost">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to admissions
            </Button>
          </Link>
          {ready && <PrintButton label="Print letter" />}
        </div>

        {ready ? (
          <AdmissionLetterPaper data={data} />
        ) : (
          <EmptyState
            icon={FileX2}
            title="No letter available"
            description="An offer letter is available once an application has been offered a place. Open the application and set its status to Offered first."
          />
        )}
      </div>
    </DashboardShell>
  );
}
