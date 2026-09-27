import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  LinkIcon,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getStudentAssignmentDetail } from "@/services/assignments";
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
import { SubmissionEditForm } from "@/components/assignments/assignment-forms";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "Assignment",
  robots: { index: false, follow: false },
};

export default async function StudentAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const detail = await getStudentAssignmentDetail(schoolId, studentId, assignmentId);

  if (!detail.assignment || !detail.visible) {
    return (
      <DashboardShell title="Assignment not available">
        <p className="text-sm text-muted-foreground">
          This assignment isn&apos;t available to you.
        </p>
        <Link href="/student/assignments" className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            My assignments
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  const assignment = detail.assignment;
  const submission = detail.submission;
  const graded = submission?.status === "graded";
  const submitted = submission?.status === "submitted" || submission?.status === "late";

  return (
    <DashboardShell title={assignment.title} badge="Assignment">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/student/assignments" className="inline-flex">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" aria-hidden="true" />
            My assignments
          </Button>
        </Link>
        {submission ? (
          <Badge variant={graded ? "default" : "secondary"}>
            {graded ? "Graded" : submitted ? "Submitted" : "Draft saved"}
          </Badge>
        ) : (
          <Badge variant="outline">Not started</Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
              <CardDescription>
                {asArray(assignment.classes)[0]?.name ?? "All classes"}
                {asArray(assignment.subjects)[0]?.name
                  ? ` · ${asArray(assignment.subjects)[0]?.name}`
                  : ""}
                {asArray(assignment.courses)[0]?.title
                  ? ` · ${asArray(assignment.courses)[0]?.title}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  Due{" "}
                  {assignment.due_date
                    ? new Date(assignment.due_date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "no due date"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  {Number(assignment.max_score)} marks
                </span>
              </div>
              {assignment.description && (
                <p className="text-sm text-muted-foreground">{assignment.description}</p>
              )}
              {assignment.instructions && (
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                  {assignment.instructions}
                </p>
              )}
              {assignment.attachment_url && (
                <a
                  href={assignment.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <LinkIcon className="size-3.5" aria-hidden="true" />
                  Download resource
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your submission</CardTitle>
              <CardDescription>
                {graded
                  ? "Graded — you can still review your work below."
                  : "Save a draft anytime, then submit when you're done. You can resubmit until the teacher grades it."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionEditForm
                assignmentId={assignment.id}
                initialText={submission?.submission_text ?? null}
                initialAttachment={submission?.attachment_url ?? null}
                submitted={submitted}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid h-fit gap-4">
          {submission && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Status</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {graded ? (
                  <>
                    <p className="flex items-center gap-2 font-medium text-emerald-600">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Graded
                    </p>
                    <p>
                      Score: <span className="font-semibold">{Number(submission.score)}</span> /{" "}
                      {Number(assignment.max_score)}
                    </p>
                    {submission.feedback && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground">Feedback</p>
                        <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                          {submission.feedback}
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {submitted ? "Submitted and awaiting grade." : "Draft saved — not submitted yet."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {submission?.submission_text && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">What you wrote</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {submission.submission_text}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}