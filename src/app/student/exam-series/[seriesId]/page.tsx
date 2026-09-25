import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CalendarClock, Clock, Layers, MoveUpRight, Shuffle, Trophy } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getStudentSeriesDetail, examTypeLabels } from "@/services/exam";
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
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "Exam series",
  robots: { index: false, follow: false },
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function StudentExamSeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const detail = await getStudentSeriesDetail(schoolId, studentId, seriesId);

  if (!detail.series || !detail.visible) {
    return (
      <DashboardShell title="Exam series not found">
        <p className="text-sm text-muted-foreground">
          This exam series isn&apos;t available for your class or was removed.
        </p>
        <Link href="/student/exam-series" className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to exam series
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  const s = detail.series;

  return (
    <DashboardShell title={s.title} badge="Student">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>About this series</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{examTypeLabels[s.examType]}</Badge>
              {s.subject && <Badge variant="outline">{s.subject}</Badge>}
              {s.className && <Badge variant="outline">{s.className}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {s.description ?? "No description."}
            </p>
            <div className="grid gap-1 text-xs text-muted-foreground">
              {s.year && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  {s.year}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <BookOpenCheck className="size-3.5" aria-hidden="true" />
                {s.questionCount} question{s.questionCount === 1 ? "" : "s"}
              </span>
              {s.durationMinutes && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {s.durationMinutes} minute{s.durationMinutes === 1 ? "" : "s"} · auto-submit on timeout
                </span>
              )}
              {s.shuffleQuestions && (
                <span className="inline-flex items-center gap-1">
                  <Shuffle className="size-3.5" aria-hidden="true" />
                  Question order is shuffled
                </span>
              )}
              {detail.sections.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Layers className="size-3.5" aria-hidden="true" />
                  {detail.sections.map((sec) => sec.title).join(" · ")}
                </span>
              )}
            </div>
            {s.questionCount > 0 ? (
              <a href={`/student/exam-series/${s.id}/practice`} className="inline-flex">
                <Button className="w-full">
                  {s.attempts > 0 ? "Practise again" : "Start practicing"}
                  <MoveUpRight className="size-4" aria-hidden="true" />
                </Button>
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                This series has no questions yet. Check back soon.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Your attempts</CardTitle>
              <CardDescription>
                Past results are marked automatically and can&apos;t be changed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.attempts.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="No attempts yet"
                  description="When you finish a practice, your score and a full answer review appear here."
                />
              ) : (
                <div className="grid gap-2">
                  {detail.attempts.map((attempt) => {
                    const pct =
                      attempt.total_marks
                        ? Math.round(((attempt.score ?? 0) / attempt.total_marks) * 100)
                        : 0;
                    return (
                      <div
                        key={attempt.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {attempt.score} / {attempt.total_marks} ({pct}%)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {attempt.correct_count} correct · {attempt.wrong_count} wrong · {formatDate(attempt.submitted_at)}
                            {attempt.status === "timed_out" ? " · timed out" : ""}
                            {attempt.status === "abandoned" ? " · abandoned" : ""}
                            {attempt.time_used_seconds ? ` · ${Math.floor(attempt.time_used_seconds / 60)}m ${attempt.time_used_seconds % 60}s used` : ""}
                          </p>
                        </div>
                        <Badge variant={pct >= 50 ? "default" : "destructive"}>
                          {pct >= 50 ? "Pass" : "Retake"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}