import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inbox, ClipboardCheck, Award, GraduationCap } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import {
  getAdmissionApplications,
  getAdmissionCounts,
  getAdmissionApplication,
} from "@/services/admissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { AdmissionsInbox } from "@/components/school/admissions-inbox";
import { ADMISSION_STATUSES, admissionStatusLabel } from "@/lib/admission-labels";
import type { AdmissionEvent, AdmissionStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Admissions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SchoolAdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.some((r) => r === "SCHOOL_OWNER" || r === "SCHOOL_ADMIN")) {
    redirect("/school");
  }

  await requireSchoolAdmin();

  // The status comes from the query string, so it is only honoured when it is a
  // real status. Anything else means "no filter".
  const activeStatus = (ADMISSION_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as AdmissionStatus)
    : undefined;

  const [applications, counts] = await Promise.all([
    getAdmissionApplications(activeStatus ? { status: activeStatus } : {}),
    getAdmissionCounts(),
  ]);

  // The list carries the application rows; fetch each timeline so the inbox can
  // show the "Activity" trail without a second round trip on expand.
  const details = await Promise.all(applications.map((a) => getAdmissionApplication(a.id)));
  const events: Record<string, AdmissionEvent[]> = {};
  for (const detail of details) {
    if (detail) events[detail.application.id] = detail.events;
  }

  return (
    <DashboardShell title="Admissions" badge="Admin">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="New"
          value={counts.submitted ?? 0}
          icon={Inbox}
          tone="amber"
          href="/school/admissions?status=submitted"
        />
        <StatCard
          title="Under review"
          value={counts.under_review ?? 0}
          icon={ClipboardCheck}
          tone="sky"
          index={1}
          href="/school/admissions?status=under_review"
        />
        <StatCard
          title="Offered"
          value={counts.offered ?? 0}
          icon={Award}
          tone="emerald"
          index={2}
          href="/school/admissions?status=offered"
        />
        <StatCard
          title="Enrolled"
          value={counts.enrolled ?? 0}
          icon={GraduationCap}
          tone="indigo"
          index={3}
          href="/school/admissions?status=enrolled"
        />
      </div>

      <div className="mt-5">
        {activeStatus ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Showing {admissionStatusLabel(activeStatus)} applications ·{" "}
            <a href="/school/admissions" className="underline">
              show all
            </a>
          </p>
        ) : null}

        <AdmissionsInbox applications={applications} events={events} />
      </div>

      {applications.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Applicants apply from your school&apos;s public admissions page. Share the
          link with prospective families.
        </p>
      )}
    </DashboardShell>
  );
}
