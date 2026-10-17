import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardCheck, ClipboardList, Users, Clock, AlertTriangle } from "lucide-react";
import { requireContentEditor } from "@/services/shared";
import { getTeacherAnalytics } from "@/services/analytics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

function formatRelative(value: string | null): string {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function TeacherAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const context = await requireContentEditor();
  if (!context.context.user) redirect("/auth/login");
  if (context.role !== "TEACHER" && context.role !== "SCHOOL_ADMIN" && context.role !== "SCHOOL_OWNER") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const selectedClassId = params.class?.trim() || null;

  const data = await getTeacherAnalytics(
    context.schoolId,
    context.userId,
    context.role,
    context.teacherId,
    selectedClassId,
  );

  const selectedClass = data.classes.find((c) => c.id === selectedClassId) ?? null;

  return (
    <DashboardShell title="Class Analytics" badge="Teacher">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href="/teacher/analytics"
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium",
            selectedClassId === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          All classes
        </Link>
        {data.classes.map((c) => (
          <Link
            key={c.id}
            href={`/teacher/analytics?class=${c.id}`}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              selectedClassId === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Students" value={data.students} icon={Users} href="/teacher/classes" tone="emerald" hint={selectedClass ? `${selectedClass.name} only` : "Across your assigned classes"} />
        <StatCard title="Assignments" value={data.publishedAssignments} icon={ClipboardList} href="/teacher/assignments" tone="indigo" index={1} hint={`${data.workload.length - data.publishedAssignments} draft`} />
        <StatCard title="Awaiting Grading" value={data.toGrade} icon={ClipboardCheck} href="/teacher/assignments" tone="amber" index={2} hint="Submissions still to mark" />
        <StatCard title="Practice Attempts" value={data.practiceAttempts} icon={BarChart3} href="/teacher/exam-series" tone="rose" index={3} hint={data.practiceAverage != null ? `Average ${data.practiceAverage}%` : "No attempts yet"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Topics to revisit</CardTitle>
            <CardDescription>
              {selectedClass
                ? `Weakest and strongest topics in ${selectedClass.name}.`
                : "Weakest and strongest topics across your classes."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
                Weakest topics
              </p>
              {data.weakTopics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No exam answers yet — publish an examination and your students&apos;
                  answers will show which topics need reteaching here.
                </p>
              ) : (
                data.weakTopics.map((t) => (
                  <div
                    key={t.topic}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.topic}</p>
                      <p className="text-xs text-muted-foreground">{t.answers} answers</p>
                    </div>
                    <Badge variant={t.average < 50 ? "destructive" : "secondary"}>
                      {t.average}%
                    </Badge>
                  </div>
                ))
              )}
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-medium">Strongest topics</p>
              {data.strongTopics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing to report yet.
                </p>
              ) : (
                data.strongTopics.map((t) => (
                  <div
                    key={t.topic}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.topic}</p>
                      <p className="text-xs text-muted-foreground">{t.answers} answers</p>
                    </div>
                    <Badge variant="secondary">{t.average}%</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class performance</CardTitle>
            <CardDescription>Engagement and grades per class.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {data.classStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No classes assigned yet — ask your school admin to link you to a class.
              </p>
            ) : (
              data.classStats.map((c) => (
                <div
                  key={c.classId}
                  className="rounded-md border bg-background px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{c.className}</p>
                    <p className="text-xs text-muted-foreground">{c.students} students</p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">{c.assignments} assignments</Badge>
                    <Badge variant="secondary">
                      {c.pending > 0 ? `${c.pending} to grade` : `${c.graded} graded`}
                    </Badge>
                    <Badge variant="outline">
                      {c.practiceAttempts} practice attempt{c.practiceAttempts === 1 ? "" : "s"}
                      {c.practiceAverage != null ? ` · avg ${c.practiceAverage}%` : ""}
                    </Badge>
                  </div>
                  {c.weakTopics.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Weak topics:{" "}
                      <span className="text-destructive">
                        {c.weakTopics.map((t) => `${t.topic} (${t.average}%)`).join(", ")}
                      </span>
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Grading workload</CardTitle>
          <CardDescription>Submissions awaiting your feedback.</CardDescription>
        </CardHeader>
          <CardContent className="grid gap-2">
            {data.workload.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assignments yet — publish one to start collecting submissions.
              </p>
            ) : (
              data.workload.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.className ?? "All classes"} ·{" "}
                      {a.published ? "published" : "draft"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <Badge variant="outline">{a.submissions} submitted</Badge>
                    {a.pending > 0 ? (
                      <Badge>{a.pending} to grade</Badge>
                    ) : (
                      <Badge variant="secondary">{a.graded} graded</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent practice activity</CardTitle>
          <CardDescription>Latest exam series attempts by your students.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.recentAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No practice attempts yet — share your exam series with students to get started.
            </p>
          ) : (
            data.recentAttempts.map((a) => (
              <div
                key={a.attemptId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.seriesTitle}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold">
                    {a.percentage != null
                      ? `${a.percentage}%`
                      : a.score != null
                        ? `${a.score} / ${a.total ?? "?"}`
                        : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatRelative(a.submittedAt)}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}