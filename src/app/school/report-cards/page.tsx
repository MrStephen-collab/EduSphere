import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireContentEditor } from "@/services/shared";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Report Cards",
  robots: { index: false, follow: false },
};

export default async function SchoolReportCardsPage() {
  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (editor.role !== "SCHOOL_ADMIN" && editor.role !== "SCHOOL_OWNER") {
    redirect("/dashboard");
  }

  return (
    <DashboardShell title="Report Cards">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Report Card Management</h1>
            <p className="text-sm text-muted-foreground">Manage traditional report cards for nursery, primary and secondary schools.</p>
          </div>
          <div className="flex gap-2">
            <Button render={<Link href="/teacher/report-cards/traditional" />}>
              <FileText className="size-4" />
              Preview Template
            </Button>
            <Button variant="outline" render={<Link href="/teacher/report-cards/entry" />}>
              Enter Results
            </Button>
          </div>
        </div>
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Select a class and term to manage report cards. Teachers can enter scores, affective & psychomotor assessments and comments.
        </div>
      </div>
    </DashboardShell>
  );
}
