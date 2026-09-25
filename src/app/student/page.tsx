import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  FileText,
  BarChart3,
  PlayCircle,
  ArrowRight,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent, getContinueLearning } from "@/services/learning";
import { getStudentAssignments } from "@/services/assignments";
import { getStudentExamSeries } from "@/services/exam";
import { getStudentAnnouncements } from "@/services/announcements";
import { AnnouncementBanner } from "@/components/announcements/announcement-banner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Student dashboard",
  robots: { index: false, follow: false },
};

export default async function StudentDashboardPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const membership = context.memberships[0];
  const schoolId = membership?.school.id;
  const name = context.profile?.full_name?.split(" ")[0] ?? "there";

  const supabase = await createSupabaseServerClient();
  const { studentId } = schoolId
    ? await requireStudent()
    : { studentId: null as string | null };

  const [
    coursesRes,
    examSeries,
    assignmentsRes,
    resultsRes,
    continueItem,
    announcements,
  ] =
    schoolId && studentId
      ? await Promise.all([
          supabase
            .from("courses")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .eq("status", "published"),
          getStudentExamSeries(schoolId, studentId),
          getStudentAssignments(schoolId, studentId),
          supabase
            .from("results")
            .select("percentage")
            .eq("school_id", schoolId)
            .eq("student_id", studentId),
          getContinueLearning(schoolId, studentId),
          getStudentAnnouncements(schoolId, studentId),
        ])
      : [null, null, null, null, null, []];

  const percentages = (resultsRes?.data ?? []) as { percentage: number | null }[];
  const valid = percentages.filter((r) => r.percentage != null) as { percentage: number }[];
  const average = valid.length
    ? Math.round(valid.reduce((sum, r) => sum + r.percentage, 0) / valid.length)
    : null;

  return (
    <DashboardShell title={`Good day, ${name}`} badge="Student">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="My Courses" value={coursesRes?.count ?? 0} icon={BookOpen} href="/student/courses" tone="indigo" />
        <StatCard title="Pending Assignments" value={assignmentsRes?.filter((a) => !a.graded).length ?? 0} icon={ClipboardList} href="/student/assignments" tone="amber" index={1} hint="Awaiting your submission or grade" />
        <StatCard title="Exam Series" value={examSeries?.length ?? 0} icon={FileText} href="/student/exam-series" tone="rose" index={2} hint="Past question series for practice" />
        <StatCard title="Average Score" value={average ?? "—"} icon={BarChart3} href="/student/results" tone="emerald" index={3} hint={average == null ? "Evaluated after your first result" : "Across published results"} />
      </div>

      <AnnouncementBanner announcements={announcements} className="mt-5" />

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card className="animate-card-enter" style={{ animationDelay: "220ms" }}>
          <CardHeader>
            <CardTitle>Continue Learning</CardTitle>
            <CardDescription>Pick up where you left off</CardDescription>
          </CardHeader>
          <CardContent>
            {continueItem ? (
              <div className="grid gap-3">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <PlayCircle className="size-10 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium">{continueItem.courseTitle}</p>
                    <p className="truncate text-sm text-muted-foreground">{continueItem.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {continueItem.progress === 100
                        ? "Completed — review it or pick another course."
                        : `${continueItem.progress}% complete`}
                    </p>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, continueItem.progress)}%` }}
                  />
                </div>
                <Link
                  href={`/student/courses/${continueItem.courseId}/lessons/${continueItem.lessonId}`}
                  className="inline-flex"
                >
                  <Button className="w-full justify-between">
                    <span>{continueItem.progress === 100 ? "Review lesson" : `Continue ${continueItem.courseTitle}`}</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <PlayCircle className="size-10 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">No lessons in progress</p>
                  <p className="text-sm text-muted-foreground">Start a course to begin learning.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-card-enter" style={{ animationDelay: "300ms" }}>
          <CardHeader>
            <CardTitle>Explore</CardTitle>
            <CardDescription>Courses, tests and results at your fingertips.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link href="/student/courses" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4" aria-hidden="true" />
                  Browse my courses
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/student/assignments" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  My assignments
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/student/exam-series" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="size-4" aria-hidden="true" />
                  Practise exam series
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/student/results" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="size-4" aria-hidden="true" />
                  My results
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/student/report-cards" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <ScrollText className="size-4" aria-hidden="true" />
                  Report cards
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}