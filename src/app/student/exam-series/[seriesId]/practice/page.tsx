import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getPracticePaper, startOrResumePracticeAttempt } from "@/services/exam";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PracticeQuiz } from "@/components/exam/practice-quiz";

export const metadata: Metadata = {
  title: "Practice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentPracticePage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const paper = await getPracticePaper(schoolId, seriesId, studentId);

  if (!paper) {
    return (
      <DashboardShell title="Practice not available">
        <p className="text-sm text-muted-foreground">
          This exam series isn&apos;t available for practice right now.
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

  if (paper.questionCount === 0) {
    return (
      <DashboardShell title={paper.title} badge="Practice">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Paper summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>{paper.subject ?? "General"} · {paper.className ?? "All classes"}</p>
              <p className="text-xs">This series has no practice questions yet.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const active = await startOrResumePracticeAttempt(schoolId, seriesId, studentId);
  if (!active) {
    return (
      <DashboardShell title="Practice not available">
        <p className="text-sm text-muted-foreground">
          This exam series isn&apos;t available for practice right now.
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

  return (
    <DashboardShell title={paper.title} badge="Practice">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Paper summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>{paper.subject ?? "General"} · {paper.className ?? "All classes"}</p>
            <p>
              {paper.questionCount} question{paper.questionCount === 1 ? "" : "s"} · {paper.totalMarks} mark
              {paper.totalMarks === 1 ? "" : "s"} total
              {active.durationMinutes ? ` · ${active.durationMinutes} minute${active.durationMinutes === 1 ? "" : "s"} limit` : ""}
            </p>
            {active.durationMinutes ? (
              <p className="text-xs">
                A countdown is running — your answers submit automatically when time runs out.
              </p>
            ) : (
              <p className="text-xs">Answer every question, then submit for instant marking.</p>
            )}
            <p className="text-xs">
              Objective answers are auto-marked and explained in the review; written essay answers are
              kept for your teacher to mark.
            </p>
            <p className="text-xs">
              Work through one question at a time. Use the palette to jump around, flag anything you
              want to revisit, and submit from the last question.
            </p>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <PracticeQuiz
            paper={paper}
            title={paper.title}
            attemptId={active.attemptId}
            startedAt={active.startedAt}
            durationMinutes={active.durationMinutes}
          />
        </div>
      </div>
    </DashboardShell>
  );
}