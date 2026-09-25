import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Flame, BookOpenCheck, ListChecks, Trophy, Activity } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getStudentProgress } from "@/services/progress";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "My progress",
  robots: { index: false, follow: false },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="grid gap-1 pt-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Icon className="size-4" aria-hidden={true} />
          {label}
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "No activity yet";
  return new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className ?? ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default async function StudentProgressPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const { schoolId, studentId } = await requireStudent();
  const data = await getStudentProgress(schoolId, studentId);

  const started =
    data.courses.reduce((sum, c) => sum + c.startedLessons, 0) || data.lessonsCompleted;

  return (
    <DashboardShell title="My Progress" badge="Student">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Trophy}
            label="Overall progress"
            value={data.overallPercentage != null ? `${Math.round(data.overallPercentage)}%` : "—"}
            sub={data.overallPercentage != null ? "Course average" : "No data yet"}
          />
          <StatCard
            icon={BookOpenCheck}
            label="Lessons completed"
            value={data.lessonsCompleted}
            sub={`${started} lesson${started === 1 ? "" : "s"} started`}
          />
          <StatCard
            icon={ListChecks}
            label="Assignments done"
            value={data.assignmentsCompleted}
          />
          <StatCard
            icon={Flame}
            label="Learning streak"
            value={`${data.learningStreak} day${data.learningStreak === 1 ? "" : "s"}`}
            sub={formatDate(data.lastActivityAt)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Activity className="size-4" aria-hidden="true" />
              Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.courses.length === 0 ? (
              <EmptyState
                icon={BookOpenCheck}
                title="No progress yet"
                description="Progress builds up as you open lessons, complete assignments and take tests."
              />
            ) : (
              <div className="grid gap-3">
                {data.courses.map((course) => {
                  const percent = course.overallPercentage ?? 0;
                  return (
                    <div key={course.courseId ?? "none"} className="grid gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{course.courseName ?? "Course"}</span>
                        <span className="text-muted-foreground">{Math.round(percent)}%</span>
                      </div>
                      <ProgressBar value={percent} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {course.finishedLessons} lesson{course.finishedLessons === 1 ? "" : "s"} done
                        {course.startedLessons > 0
                          ? ` · ${course.startedLessons} started`
                          : ""}
                        {course.assignmentsCompleted > 0
                          ? ` · ${course.assignmentsCompleted} assignment${course.assignmentsCompleted === 1 ? "" : "s"}`
                          : ""}
                        {course.testsCompleted > 0
                          ? ` · ${course.testsCompleted} test${course.testsCompleted === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}