import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getSchoolEvents } from "@/services/school-media";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EventsManager } from "@/components/school/events-manager";

export const metadata: Metadata = {
  title: "School events",
  robots: { index: false, follow: false },
};

export default async function SchoolEventsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const events = await getSchoolEvents(schoolId);

  return (
    <DashboardShell title="School Events" badge="Admin">
      <EventsManager events={events} />
    </DashboardShell>
  );
}