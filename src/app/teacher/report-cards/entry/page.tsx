import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContentEditor } from "@/services/shared";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TraditionalReportCardEntry } from "@/components/report/traditional/traditional-report-card-entry";

export const metadata: Metadata = {
  title: "Report Card Entry",
  robots: { index: false, follow: false },
};

export default async function TeacherReportCardEntryPage() {
  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (editor.role !== "TEACHER" && editor.role !== "SCHOOL_ADMIN" && editor.role !== "SCHOOL_OWNER") {
    redirect("/dashboard");
  }

  return (
    <DashboardShell title="Report Card Entry">
      <TraditionalReportCardEntry />
    </DashboardShell>
  );
}
