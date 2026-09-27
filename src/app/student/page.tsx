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
import { Suspense } from "react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent, getContinueLearning } from "@/services/learning";
import { getStudentAssignments } from "@/services/assignments";
import { getStudentAnnouncements } from "@/services/announcements";
import { getServerData } from "@/lib/server-cache";
import { AnnouncementBanner } from "@/components/announcements/announcement-banner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
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

async function getStudentDashboardBundle() {
  const { schoolId, studentId } = await requireStudent();
  return getServerData(`dash:student:${schoolId}:${studentId}`, 20_000, async () => {
    const supabase = await createSupabaseServerClient();
    const [coursesRes, assignmentsRes, continueItem, announcements] = await Promise.all([
      supabase
        .from("courses")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "published"),
      getStudentAssignments(schoolId, studentId),
      getContinueLearning(schoolId, studentId),
      getStudentAnnouncements(schoolId, studentId),
    ]);
    return {
      courseCount: coursesRes?.count ?? 0,
      pendingCount: assignmentsRes?.filter((a) => !a.graded).length ?? 0,
      continueItem,
      announcements,
    };
  });
}

function StudentDashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <StatCardSkeleton key={i} index={i} />
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="relative h-64 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
            <div className="skeleton absolute inset-0" />
          </div>
        ))}
      </div>
    </>
  );
}

async function StudentDashboardContent() {
  const bundle = await getStudentDashboardBundle();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="My Courses" value={bundle.courseCount} icon={BookOpen} href="/student/courses" tone="indigo" />
        <StatCard title="Pending Assignments" value={bundle.pendingCount} icon={ClipboardList} href="/student/assignments" tone="amber" index={1} hint="Awaiting your submission or grade" />
      </div>

      <AnnouncementBanner announcements={bundle.announcements} className="mt-5" />

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card className="animate-card-enter" style={{ animationDelay: "220ms" }}>
          <CardHeader>
            <CardTitle>Continue Learning</CardTitle>
            <CardDescription>Pick up where you left off</CardDescription>
          </CardHeader>
          <CardContent>
            {bundle.continueItem ? (
              <div className="grid gap-3">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <PlayCircle className="size-10 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium">{bundle.continueItem.courseTitle}</p>
                    <p className="truncate text-sm text-muted-foreground">{bundle.continueItem.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {bundle.continueItem.progress === 100
                        ? "Completed — review it or pick another course."
                        : `${bundle.continueItem.progress}% complete`}
                    </p>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, bundle.continueItem.progress)}%` }}
                  />
                </div>
                <Link
                  href={`/student/courses/${bundle.continueItem.courseId}/lessons/${bundle.continueItem.lessonId}`}
                  className="inline-flex"
                >
                  <Button className="h-11 w-full justify-between">
                    <span>{bundle.continueItem.progress === 100 ? "Review lesson" : `Continue ${bundle.continueItem.courseTitle}`}</span>
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
              <Button variant="outline" className="h-11 w-full justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4" aria-hidden="true" />
                  Browse my courses
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/student/assignments" className="inline-flex">
              <Button variant="outline" className="h-11 w-full justify-between">
                <span className="flex items-center gap-2">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  My assignments
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/student/exam-series" className="inline-flex">
              <Button variant="outline" className="h-11 w-full justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="size-4" aria-hidden="true" />
                  Practise exam series
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/student/results" className="inline-flex">
              <Button variant="outline" className="h-11 w-full justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="size-4" aria-hidden="true" />
                  My results
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/student/report-cards" className="inline-flex">
              <Button variant="outline" className="h-11 w-full justify-between">
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
    </>
  );
}

export default async function StudentDashboardPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const name = context.profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <DashboardShell title={`Good day, ${name}`} badge="Student">
      <Suspense fallback={<StudentDashboardSkeleton />}>
        <StudentDashboardContent />
      </Suspense>
    </DashboardShell>
  );
}