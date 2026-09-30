import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireParent } from "@/services/parent";
import { getMyComplaints } from "@/services/complaints";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquareWarning } from "lucide-react";
import { ComplaintComposer } from "@/components/parent/complaint-composer";
import { ComplaintThread } from "@/components/parent/complaint-thread";
import {
  complaintCategoryLabel,
  complaintStatusLabel,
} from "@/lib/complaint-labels";

export const metadata: Metadata = {
  title: "Complaints & advice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Only the colour is local; the wording comes from the shared labels so the
// parent and the admin never disagree about what a status is called.
const statusBadgeClass: Record<string, string> = {
  open: "bg-amber-50 text-amber-800 border-amber-500/40",
  in_progress: "bg-sky-50 text-sky-800 border-sky-500/40",
  resolved: "bg-emerald-50 text-emerald-800 border-emerald-500/40",
};

export default async function ParentComplaintsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("PARENT")) redirect("/dashboard");

  const { userId } = await requireParent();
  const threads = await getMyComplaints(userId);

  return (
    <DashboardShell title="Complaints & Advice" badge="Parent">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Raise something with the school</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplaintComposer />
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <h2 className="text-sm font-semibold">Your complaints</h2>
          {threads.length === 0 ? (
            <EmptyState
              icon={MessageSquareWarning}
              title="Nothing raised yet"
              description="Use the form to raise a concern or give the school advice. You will be able to follow the school's reply here."
            />
          ) : (
            threads.map((thread) => (
              <div key={thread.id} className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {complaintCategoryLabel(thread.category)}
                  </Badge>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs ${
                      statusBadgeClass[thread.status] ?? ""
                    }`}
                  >
                    {complaintStatusLabel(thread.status)}
                  </span>
                </div>
                <ComplaintThread
                  complaintId={thread.id}
                  subject={thread.subject}
                  status={thread.status}
                  messages={thread.messages}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
