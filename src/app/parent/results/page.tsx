import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getParentChildren, requireParent, resolveChild } from "@/services/parent";
import { getStudentResults } from "@/services/analytics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { UsersRound } from "lucide-react";
import { ChildPicker } from "@/components/parent/child-picker";
import { ResultsOverview } from "@/components/results/results-overview";

export const metadata: Metadata = {
  title: "Child results",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ParentResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child: childParam } = await searchParams;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("PARENT")) redirect("/dashboard");

  const { schoolId, parentId } = await requireParent();
  const children = await getParentChildren(schoolId, parentId);
  const child = resolveChild(children, childParam);

  if (!child) {
    return (
      <DashboardShell title="Child Results" badge="Parent">
        <EmptyState
          icon={UsersRound}
          title="No children linked yet"
          description="Children linked to your account will appear here. Ask your school to link your account."
        />
      </DashboardShell>
    );
  }

  const data = await getStudentResults(schoolId, child.studentId);

  return (
    <DashboardShell title="Child Results" badge="Parent">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{child.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {child.className ?? "No class"}
              {child.streamName ? ` · ${child.streamName}` : ""} · {child.admissionNumber}
            </p>
          </div>
          <ChildPicker options={children} childId={child.studentId} />
        </div>
        <ResultsOverview
          data={data}
          emptyDescription="Your child hasn&apos;t finished any practice or graded work yet — results appear here once they do."
        />
      </div>
    </DashboardShell>
  );
}