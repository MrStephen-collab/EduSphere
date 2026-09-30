import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import {
  getSchoolComplaints,
  getComplaintCounts,
  getComplaintThread,
  getAssignableStaff,
} from "@/services/complaints";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { MessageSquareWarning, Inbox, CheckCircle2, Clock } from "lucide-react";
import { ComplaintInbox } from "@/components/school/complaint-inbox";
import { COMPLAINT_STATUSES, complaintStatusLabel } from "@/lib/complaint-labels";
import type { ComplaintStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Complaints",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SchoolComplaintsPage({
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

  const { schoolId } = await requireSchoolAdmin();

  // The status comes from the query string, so it is only honoured when it is
  // one of the real statuses. Anything else means "no filter" rather than
  // being passed through to the database.
  const activeStatus = COMPLAINT_STATUSES.includes(status as ComplaintStatus)
    ? (status as ComplaintStatus)
    : undefined;

  const [complaints, counts, staff] = await Promise.all([
    getSchoolComplaints(activeStatus ? { status: activeStatus } : {}),
    getComplaintCounts(),
    getAssignableStaff(schoolId),
  ]);

  // The list carries counts but not the bodies; fetch the messages for the
  // threads actually on screen so the inbox can render each conversation.
  const threads = await Promise.all(complaints.map((c) => getComplaintThread(c.id)));
  const messages: Record<string, NonNullable<(typeof threads)[number]>["messages"]> = {};
  for (const thread of threads) {
    if (thread) messages[thread.id] = thread.messages;
  }

  return (
    <DashboardShell title="Parent Complaints" badge="Admin">
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          title="Open"
          value={counts.open ?? 0}
          icon={Inbox}
          tone="amber"
          href="/school/complaints?status=open"
        />
        <StatCard
          title="In progress"
          value={counts.in_progress ?? 0}
          icon={Clock}
          tone="sky"
          index={1}
          href="/school/complaints?status=in_progress"
        />
        <StatCard
          title="Resolved"
          value={counts.resolved ?? 0}
          icon={CheckCircle2}
          tone="emerald"
          index={2}
          href="/school/complaints?status=resolved"
        />
      </div>

      <div className="mt-5">
        {status && status !== "all" ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Showing {complaintStatusLabel(status)} complaints ·{" "}
            <a href="/school/complaints" className="underline">
              show all
            </a>
          </p>
        ) : null}

        <ComplaintInbox complaints={complaints} messages={messages} staff={staff} />
      </div>

      {complaints.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquareWarning className="size-4" aria-hidden="true" />
          Parents raise these from their portal under Complaints &amp; Advice.
        </p>
      )}
    </DashboardShell>
  );
}
