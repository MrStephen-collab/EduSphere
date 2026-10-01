import type { Metadata } from "next";
import { requireSchoolAdmin } from "@/services/shared";
import { getReportOptions } from "@/services/report-cards";
import { getSchoolLiveSessions } from "@/services/live";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LiveSessionForm } from "@/components/live/live-session-form";
import { LiveSessionList } from "@/components/live/live-session-list";

export const metadata: Metadata = {
  title: "Live sessions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SchoolLivePage() {
  const { schoolId } = await requireSchoolAdmin();

  const [options, sessions] = await Promise.all([
    getReportOptions(schoolId),
    getSchoolLiveSessions(schoolId),
  ]);

  return (
    <DashboardShell title="Live sessions" badge="School">
      <div className="grid gap-4">
        {!options.classes.length ? (
          <p className="text-sm text-muted-foreground">
            Create a class before scheduling a live session.
          </p>
        ) : (
          <LiveSessionForm classes={options.classes} />
        )}

        <LiveSessionList sessions={sessions} now={new Date().toISOString()} />

        <p className="text-xs text-muted-foreground">
          Every live session in the school, across all classes and teachers. A
          register is taken by the teacher who owns the class.
        </p>
      </div>
    </DashboardShell>
  );
}
