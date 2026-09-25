import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ClipboardList, GraduationCap, MoveUpRight, SquareCheckBig } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getStudentAssignments } from "@/services/assignments";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "My assignments",
  robots: { index: false, follow: false },
};

function dueLabel(dueDate: string | null): { text: string; overdue: boolean } {
  if (!dueDate) return { text: "No due date", overdue: false };
  const due = new Date(dueDate);
  const overdue = new Date() > due;
  return {
    text: `Due ${due.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`,
    overdue,
  };
}

export default async function StudentAssignmentsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const items = await getStudentAssignments(schoolId, studentId);

  return (
    <DashboardShell title="My Assignments" badge="Student">
      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="When a teacher publishes an assignment for your class, it will show up here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const due = dueLabel(item.dueDate);
            return (
              <Link
                key={item.id}
                href={`/student/assignments/${item.id}`}
                className="grid"
              >
                <Card className="flex h-full flex-col">
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
                    {item.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                    )}
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
                      <div className="flex items-center justify-between gap-2">
                        {item.graded ? (
                          <Badge className="gap-1">
                            <SquareCheckBig className="size-3" aria-hidden="true" />
                            Graded — {Number(item.score)}/{Number(item.maxScore)}
                          </Badge>
                        ) : item.status === "submitted" ? (
                          <Badge variant="secondary">Submitted</Badge>
                        ) : item.status === "draft" ? (
                          <Badge variant="secondary">Draft saved</Badge>
                        ) : item.status === "late" ? (
                          <Badge variant="destructive">Overdue</Badge>
                        ) : (
                          <Badge variant="outline">Not started</Badge>
                        )}
                        <Button variant="ghost" size="sm" className="gap-1">
                          {item.graded ? "Review" : item.status === "submitted" ? "Edit" : "Open"}
                          <MoveUpRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}