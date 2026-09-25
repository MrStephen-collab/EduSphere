import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileQuestion, PenLine, PlusCircle } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getExamSeriesDetail, examTypeLabels } from "@/services/exam";
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
  SeriesEditorForm,
  SeriesStatusToggle,
  SeriesDeleteButton,
  QuestionCreateForm,
  QuestionRow,
} from "@/components/exam/series-forms";
import { SectionsManager } from "@/components/exam/sections-manager";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "Exam series",
  robots: { index: false, follow: false },
};

export default async function TeacherExamSeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId, userId, role } = await requireContentEditor();
  const detail = await getExamSeriesDetail(schoolId, seriesId, userId, role);

  if (!detail.series) {
    return (
      <DashboardShell title="Exam series not found">
        <p className="text-sm text-muted-foreground">
          This exam series could not be found or was deleted.
        </p>
        <Link href="/teacher/exam-series" className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to exam series
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  const series = detail.series;
  const [subjects, classes] = await Promise.all([
    getSubjects(schoolId),
    getClasses(schoolId),
  ]);

  return (
    <DashboardShell title={series.title} badge="Teacher">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <div className="grid gap-4 h-fit">
          <Card>
            <CardHeader>
              <CardTitle>Series details</CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-2">
                  <Badge variant="secondary">{examTypeLabels[series.exam_type]}</Badge>
                  {series.status === "published" ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {series.year && (
                <p className="text-xs text-muted-foreground">
                  Editions: <span className="font-medium text-foreground">{series.year}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Class: <span className="font-medium text-foreground">{series.classes?.name ?? "All classes"}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Subject: <span className="font-medium text-foreground">{series.subjects?.name ?? "General"}</span>
              </p>
              {series.duration_minutes ? (
                <p className="text-xs text-muted-foreground">
                  Timing: <span className="font-medium text-foreground">{series.duration_minutes} minute{series.duration_minutes === 1 ? "" : "s"} · auto-submit on timeout</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Timing: <span className="font-medium text-foreground">Untimed practice</span>
                </p>
              )}
              {series.shuffle_questions && (
                <p className="text-xs text-muted-foreground">
                  Questions are shuffled per attempt.
                </p>
              )}
              {series.description && (
                <p className="text-sm text-muted-foreground">{series.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <SeriesStatusToggle seriesId={series.id} status={series.status} />
                <SeriesDeleteButton seriesId={series.id} />
              </div>
            </CardContent>
          </Card>

<Card>
              <CardHeader>
                <CardTitle>Edit series</CardTitle>
              </CardHeader>
              <CardContent>
                <SeriesEditorForm
                  seriesId={series.id}
                  initial={{
                    title: series.title,
                    examType: series.exam_type,
                    year: series.year ?? "",
                    description: series.description ?? "",
                    subjectId: series.subject_id ?? "",
                    classId: series.class_id ?? "",
                    status: series.status,
                    durationMinutes: series.duration_minutes != null ? String(series.duration_minutes) : "",
                    shuffleQuestions: series.shuffle_questions,
                  }}
                  subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
                  classes={classes.map((c) => ({ id: c.id, name: c.name }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sections</CardTitle>
                <CardDescription>
                  Group questions into ordered papers (e.g. Objectives / Theory) shown to students in exact order.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SectionsManager seriesId={series.id} sections={detail.sections} />
              </CardContent>
            </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                Objective questions are auto-marked when a student practises. Essay questions keep the
                student&apos;s full answer for you to mark manually.
              </CardDescription>
              <div>
                <Link href={`/teacher/exam-series/${series.id}/marking`} className="inline-flex">
                  <Button variant="outline" size="sm">
                    <PenLine className="size-4" aria-hidden="true" />
                    Mark essays
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {detail.questions.length === 0 ? (
                <EmptyState
                  icon={FileQuestion}
                  title="No questions in this series yet"
                  description="Add the first past question with the form below. Students can only practice once the series is published and has questions."
                />
              ) : (
                <div className="grid gap-2">
                  {detail.questions.map((q) => (
                    <QuestionRow
                      key={q.id}
                      question={q}
                      seriesId={series.id}
                      sections={detail.sections.map((s) => ({ id: s.id, name: s.title }))}
                    />
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 pb-2">
                  <PlusCircle className="size-4 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold">Add another question</p>
                </div>
                <QuestionCreateForm
                  seriesId={series.id}
                  sections={detail.sections.map((s) => ({ id: s.id, name: s.title }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}