import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardList, GraduationCap, SquareCheckBig } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getParentChildren, requireParent, resolveChild } from "@/services/parent";
import { getStudentAssignments } from "@/services/assignments";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChildPicker } from "@/components/parent/child-picker";

export const metadata: Metadata = {
  title: "Child assignments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function dueLabel(dueDate: string | null): { text: string; overdue: boolean } {
  if (!dueDate) return { text: "No due date", overdue: false };
  const due = new Date(dueDate);
  const overdue = new Date() > due;
  return {
    text: `Due ${due.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`,
    overdue,
  };
}

export default async function ParentAssignmentsPage({
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
      <DashboardShell title="Child Assignments" badge="Parent">
        <EmptyState
          icon={ClipboardList}
          title="No children linked yet"
          description="Children linked to your account will appear here. Ask your school to link your account."
        />
      </DashboardShell>
    );
  }

  const items = await getStudentAssignments(schoolId, child.studentId);

  return (
    <DashboardShell title="Child Assignments" badge="Parent">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{child.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {child.className ?? "No class"}
              {child.streamName ? ` · ${child.streamName}` : ""}
            </p>
          </div>
          <ChildPicker options={children} childId={child.studentId} />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assignments yet"
            description="When a teacher publishes an assignment for your child's class, it will show up here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const due = dueLabel(item.dueDate);
              return (
                <Card key={item.id}>
                  <CardContent className="grid flex-1 gap-3 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.subject && <Badge variant="secondary">{item.subject}</Badge>}
                      {item.className && (
                        <Badge variant="outline">
                          <GraduationCap className="mr-1 size-3" aria-hidden="true" />
                          {item.className}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <h3 className="line-clamp-2 font-semibold">{item.title}</h3>
                      {item.courseTitle && (
                        <p className="text-xs text-muted-foreground">{item.courseTitle}</p>
                      )}
                    </div>
                    <div className="mt-auto grid gap-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            due.overdue && !item.graded ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          <CalendarDays className="size-3.5" aria-hidden="true" />
                          {due.text}
                        </span>
                        <span className="font-medium">{Number(item.maxScore)} marks</span>
                      </div>
                      {item.graded ? (
                        <Badge className="gap-1">
                          <SquareCheckBig className="size-3" aria-hidden="true" />
                          Graded — {Number(item.score)}/{Number(item.maxScore)}
                        </Badge>
                      ) : item.status === "submitted" ? (
                        <Badge variant="secondary">Submitted</Badge>
                      ) : item.status === "late" ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        <Badge variant="outline">Not started</Badge>
                      )}
                    </div>
                    {!item.graded && (
                      <Button variant="ghost" size="sm" disabled className="justify-between">
                        Awaiting feedback
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}