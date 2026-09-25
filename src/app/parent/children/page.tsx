import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, ClipboardList, ScrollText, UserRoundCheck, UsersRound } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getParentChildren, requireParent } from "@/services/parent";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My children",
  robots: { index: false, follow: false },
};

export default async function ParentChildrenPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("PARENT")) redirect("/dashboard");

  const { schoolId, parentId } = await requireParent();
  const children = await getParentChildren(schoolId, parentId);

  return (
    <DashboardShell title="My Children" badge="Parent">
      {children.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No children linked yet"
          description="Children linked to your account will appear here. Ask your school to link your account."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {children.map((child) => (
            <Card key={child.studentId}>
              <CardContent className="grid gap-3 pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <UserRoundCheck className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{child.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {child.className ?? "No class"}
                      {child.streamName ? ` · ${child.streamName}` : ""}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Admission no: {child.admissionNumber}</p>
                <div className="grid gap-1.5">
                  <Link href={`/parent/results?child=${child.studentId}`} className="inline-flex w-full">
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="size-4" aria-hidden="true" />
                        Results
                      </span>
                    </Button>
                  </Link>
                  <Link href={`/parent/assignments?child=${child.studentId}`} className="inline-flex w-full">
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <ClipboardList className="size-4" aria-hidden="true" />
                        Assignments
                      </span>
                    </Button>
                  </Link>
                  <Link href={`/parent/report-cards?child=${child.studentId}`} className="inline-flex w-full">
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <ScrollText className="size-4" aria-hidden="true" />
                        Report cards
                      </span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}