import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Inbox,
  LinkIcon,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getAssignmentDetail } from "@/services/assignments";
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
import { Separator } from "@/components/ui/separator";
import {
  AssignmentEditorForm,
  AssignmentStatusToggle,
  AssignmentDeleteButton,
  GradeSubmissionForm,
} from "@/components/assignments/assignment-forms";

export const metadata: Metadata = {
  title: "Assignment",
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

export default async function TeacherAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId, userId, role } = await requireContentEditor();
  const detail = await getAssignmentDetail(schoolId, assignmentId, userId, role);

  if (!detail) {
    return (
      <DashboardShell title="Assignment not found">
        <p className="text-sm text-muted-foreground">
          This assignment could not be found or was deleted.
        </p>
        <Link href="/teacher/assignments" className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to assignments
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  const { assignment, submissions } = detail;
  const [subjects, classes, courses] = await Promise.all([
    getSubjects(schoolId),
    getClasses(schoolId),
    listCourses(schoolId),
  ]);

  const ungraded = submissions
    .filter((s) => s.status !== "graded")
    .sort((a, b) =>
      (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""),
    );
  const graded = submissions
    .filter((s) => s.status === "graded")
    .sort((a, b) =>
      (b.graded_at ?? "").localeCompare(a.graded_at ?? ""),
    );

  const renderSubmission = (
    submission: (typeof submissions)[number],
  ) => {
    const studentName = submission.students?.display_name ?? "Student";
    return (
      <Card key={submission.id}>
        <CardContent className="grid gap-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="font-medium">{studentName}</p>
              <Badge
                variant={
                  submission.status === "graded"
                    ? "default"
                    : submission.status === "late"
                      ? "destructive"
                      : "secondary"
                }
              >
                {submission.status === "graded"
                  ? "Graded"
                  : submission.status === "late"
                    ? "Late"
                    : "Submitted"}
              </Badge>
            </div>
            {submission.submitted_at && (
              <span className="text-xs text-muted-foreground">
                Submitted{" "}
                {new Date(submission.submitted_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>

          {submission.submission_text ? (
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
              {submission.submission_text}
            </p>
          ) : (
            !submission.attachment_url && (
              <p className="text-sm text-muted-foreground">No text submitted.</p>
            )
          )}

          {submission.attachment_url && (
            <a
              href={submission.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <LinkIcon className="size-3.5" aria-hidden="true" />
              Open attachment
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}

          {submission.score != null && (
            <p className="text-sm font-medium text-emerald-600">
              Score: {Number(submission.score)} / {Number(assignment.max_score)}
            </p>
          )}

          <GradeSubmissionForm
            submissionId={submission.id}
            assignmentId={assignment.id}
            defaultScore={submission.score}
            defaultFeedback={submission.feedback}
            maxScore={Number(assignment.max_score)}
          />
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardShell title={assignment.title} badge="Assignment">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/teacher/assignments" className="inline-flex">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" aria-hidden="true" />
            My assignments
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <AssignmentStatusToggle assignmentId={assignment.id} status={assignment.status} />
          <AssignmentDeleteButton assignmentId={assignment.id} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              {assignment.classes?.name ?? "All classes"}
              {assignment.subjects?.name ? ` · ${assignment.subjects.name}` : ""}
              {assignment.courses?.title ? ` · ${assignment.courses.title}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                Due {formatDue(assignment.due_date) ?? "no due date"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList className="size-4" aria-hidden="true" />
                {Number(assignment.max_score)} marks
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-4" aria-hidden="true" />
                {submissions.length} submission{submissions.length === 1 ? "" : "s"}
              </span>
            </div>
            {assignment.description && (
              <p className="text-sm text-muted-foreground">{assignment.description}</p>
            )}
            {assignment.instructions && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Instructions</p>
                <p className="whitespace-pre-wrap text-sm">{assignment.instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Edit assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignmentEditorForm
              assignmentId={assignment.id}
              initial={{
                title: assignment.title,
                description: assignment.description ?? "",
                instructions: assignment.instructions ?? "",
                classId: assignment.class_id ?? "",
                subjectId: assignment.subject_id ?? "",
                courseId: assignment.course_id ?? "",
                dueDate: assignment.due_date ? assignment.due_date.slice(0, 10) : "",
                maxScore: String(assignment.max_score),
                attachmentUrl: assignment.attachment_url ?? "",
                status: assignment.status,
              }}
              subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              courses={courses.map((c) => ({ id: c.id, name: c.title }))}
            />
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      <div className="grid gap-4">
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Inbox className="size-4 text-primary" aria-hidden="true" />
            To grade ({ungraded.length})
          </h2>
          {ungraded.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to grade. Nice!</p>
          ) : (
            <div className="grid gap-3">{ungraded.map(renderSubmission)}</div>
          )}
        </div>

        {graded.length > 0 && (
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
              Graded ({graded.length})
            </h2>
            <div className="grid gap-3">{graded.map(renderSubmission)}</div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}