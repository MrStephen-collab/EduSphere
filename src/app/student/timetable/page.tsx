import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { getStudentTimetable } from "@/services/timetable";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TimetableView } from "@/components/timetable/timetable-view";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "Timetable",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentTimetablePage() {
  const result = await getStudentTimetable();

  if (!result) {
    return (
      <DashboardShell title="Timetable" badge="Student">
        <EmptyState
          icon={CalendarDays}
          title="No timetable yet"
          description="Your school has not published a timetable for your class. Check back after your admin sets one up."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Timetable" badge="Student">
      <div className="grid gap-4">
        <TimetableView grid={result.grid} className={result.className} />
        <p className="text-xs text-muted-foreground">
          Times are shown as your school set them. If a lesson looks wrong, tell
          your teacher — the timetable is maintained by your school.
        </p>
      </div>
    </DashboardShell>
  );
}
