import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContentEditor } from "@/services/shared";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TraditionalReportCardPreview } from "@/components/report/traditional/traditional-report-card-preview";

export const metadata: Metadata = {
  title: "Traditional Report Card",
  robots: { index: false, follow: false },
};

export default async function TraditionalReportCardPage() {
  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (editor.role !== "TEACHER" && editor.role !== "SCHOOL_ADMIN" && editor.role !== "SCHOOL_OWNER") {
    redirect("/dashboard");
  }

  return (
    <DashboardShell title="Traditional Report Card">
      <TraditionalReportCardPreview />
    </DashboardShell>
  );
}
