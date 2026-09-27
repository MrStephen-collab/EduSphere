import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardList, FileText, MoveUpRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { listTeacherAssignments } from "@/services/assignments";
import { listCourses } from "@/services/learning";
import { getSubjects, getClasses } from "@/services/academics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AssignmentCreateForm,
  AssignmentStatusToggle,
  AssignmentDeleteButton,
} from "@/components/assignments/assignment-forms";
import { EmptyState } from "@/components/dashboard/empty-state";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "My assignments",
  robots: { index: false, follow: false },
};

function formatDue(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function TeacherAssignmentsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId, userId, role } = await requireContentEditor();

  const [items, subjects, classes, courses] = await Promise.all([
    listTeacherAssignments(schoolId, userId, role),
    getSubjects(schoolId),
    getClasses(schoolId),
    listCourses(schoolId),
  ]);

  return (
    <DashboardShell title="My Assignments" badge="Teacher">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Create assignment</CardTitle>
            <CardDescription>
              Set an assignment for a class. Publish to make it visible to students.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssignmentCreateForm
              subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              courses={courses.map((c) => ({ id: c.id, name: c.title }))}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {items.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assignments yet"
              description="Assignments let you collect work from your students. Create your first one with the form, then grade submissions from the assignment page."
            />
          ) : (
            <div className="grid gap-3">
              {items.map(({ assignment, submissions, pending, graded }) => (
                <Card key={assignment.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{assignment.title}</h3>
                        <Badge variant={assignment.status === "published" ? "default" : "outline"}>
                          {assignment.status === "published" ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {asArray(assignment.classes)[0]?.name && (
                          <span>{asArray(assignment.classes)[0]?.name}</span>
                        )}
                        {asArray(assignment.subjects)[0]?.name && (
                          <span>{asArray(assignment.subjects)[0]?.name}</span>
                        )}
                        {asArray(assignment.courses)[0]?.title && (
                          <span>{asArray(assignment.courses)[0]?.title}</span>
                        )}
                        {assignment.due_date && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5" aria-hidden="true" />
                            Due {formatDue(assignment.due_date)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <FileText className="size-3.5" aria-hidden="true" />
                          {submissions} submission{submissions === 1 ? "" : "s"}
                          {pending > 0 && <span className="font-medium text-amber-600">· {pending} to grade</span>}
                          {submissions > 0 && pending === 0 && (
                            <span className="text-emerald-600">· {graded} graded</span>
                          )}
                        </span>
                      </div>
                      {assignment.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{assignment.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <AssignmentStatusToggle assignmentId={assignment.id} status={assignment.status} />
                      <a href={`/teacher/assignments/${assignment.id}`} className="inline-flex">
                        <Button size="sm" variant="outline">
                          Review
                          <MoveUpRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      </a>
                      <AssignmentDeleteButton assignmentId={assignment.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}