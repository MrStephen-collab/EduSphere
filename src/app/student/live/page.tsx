import type { Metadata } from "next";
import { getStudentLiveSessions } from "@/services/live";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StudentLiveSessionList } from "@/components/live/live-session-list";

export const metadata: Metadata = {
  title: "Live sessions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentLivePage() {
  const sessions = await getStudentLiveSessions();

  return (
    <DashboardShell title="Live sessions" badge="Student">
      <div className="grid gap-4">
        <StudentLiveSessionList sessions={sessions} now={new Date().toISOString()} />
        <p className="text-xs text-muted-foreground">
          Joining opens your teacher&apos;s video provider in a new tab. Times are
          shown in your device&apos;s time zone.
        </p>
      </div>
    </DashboardShell>
  );
}
