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
  Flame,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/auth-context";
import {
  requireStudent,
  getContinueLearning,
  getStudentCourses,
} from "@/services/learning";
import { getStudentAssignments, type StudentAssignmentItem } from "@/services/assignments";
import { getStudentAnnouncements } from "@/services/announcements";
import { getStudentProgress } from "@/services/progress";
import { getStudentExamSeries } from "@/services/exam";
import { getSchoolLevel } from "@/services/schools";
import { levelOffersCourses } from "@/lib/education/levels";
import { getServerData } from "@/lib/server-cache";
import { AnnouncementBanner } from "@/components/announcements/announcement-banner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WelcomeHeader } from "@/components/dashboard/welcome-header";
import { ProgressBar } from "@/components/dashboard/progress-bar";
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
  const { schoolId, studentId, classId } = await requireStudent();
  return getServerData(`dash:student:${schoolId}:${studentId}`, 20_000, async () => {
    const supabase = await createSupabaseServerClient();
    const [coursesRes, assignments, continueItem, announcements, progress, courses, examSeries, level] =
      await Promise.all([
        supabase
          .from("courses")
          .select("*", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("status", "published"),
        getStudentAssignments(schoolId, studentId),
        getContinueLearning(schoolId, studentId),
        getStudentAnnouncements(schoolId, studentId),
        getStudentProgress(schoolId, studentId),
        getStudentCourses(schoolId, studentId, classId),
        getStudentExamSeries(schoolId, studentId),
        getSchoolLevel(schoolId),
      ]);
    return {
      // "Courses" is college-and-above wording; nursery through secondary
      // call the same things lessons.
      offersCourses: levelOffersCourses(level),
      courseCount: coursesRes?.count ?? 0,
      pendingCount: assignments?.filter((a) => !a.graded).length ?? 0,
      assignments,
      continueItem,
      announcements,
      progress,
      courses,
      examSeries,
    };
  });
}

function formatDue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function averageScore(assignments: StudentAssignmentItem[]): {
  value: number | null;
  gradedCount: number;
} {
  const graded = assignments.filter((a) => a.graded && a.score != null && a.maxScore > 0);
  if (graded.length === 0) return { value: null, gradedCount: 0 };
  const total = graded.reduce((sum, a) => sum + (a.score! / a.maxScore) * 100, 0);
  return { value: Math.round(total / graded.length), gradedCount: graded.length };
}

function StudentDashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCardSkeleton key={i} index={i} />
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="relative h-64 overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <div className="skeleton absolute inset-0" />
          </div>
        ))}
      </div>
    </>
  );
}

async function StudentDashboardContent() {
  const bundle = await getStudentDashboardBundle();
  const { value: avgScore, gradedCount } = averageScore(bundle.assignments);
  const streak = bundle.progress.learningStreak;
  const upcoming = bundle.assignments
    .filter((a) => !a.graded && a.status !== "submitted")
    .slice(0, 4);
  const myCourses = bundle.courses.slice(0, 6);
  const practiceExams = bundle.examSeries.slice(0, 3);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title={bundle.offersCourses ? "My Courses" : "My Lessons"}
          value={bundle.courseCount}
          icon={BookOpen}
          href="/student/courses"
          tone="indigo"
        />
        <StatCard
          title="Pending Assignments"
          value={bundle.pendingCount}
          icon={ClipboardList}
          href="/student/assignments"
          tone="amber"
          index={1}
          hint="Awaiting submission or grade"
        />
        <StatCard
          title="Average Score"
          value={avgScore == null ? "—" : `${avgScore}%`}
          icon={BarChart3}
          href="/student/results"
          tone="emerald"
          index={2}
          hint={gradedCount ? `Across ${gradedCount} graded` : "No graded work yet"}
        />
        <StatCard
          title="Learning Streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          icon={Flame}
          tone="sky"
          index={3}
          hint="Consecutive active days"
        />
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
                  {bundle.continueItem.hasVideo ? (
                    <PlayCircle className="size-10 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <BookOpen className="size-10 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
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
                <ProgressBar value={bundle.continueItem.progress} label="Lesson progress" />
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
                <BookOpen className="size-10 shrink-0 text-muted-foreground" aria-hidden="true" />
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
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Assignments that still need you</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length > 0 ? (
              <ul className="grid gap-2">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <CalendarClock
                          className={a.overdue ? "size-5 shrink-0 text-destructive" : "size-5 shrink-0 text-gold"}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{a.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[a.subject, a.courseTitle].filter(Boolean).join(" · ") || "Assignment"}
                          </span>
                        </span>
                      </span>
                      <span
                        className={
                          a.overdue
                            ? "shrink-0 text-xs font-medium text-destructive"
                            : "shrink-0 text-xs text-muted-foreground"
                        }
                      >
                        {a.dueDate ? (a.overdue ? `Overdue · ${formatDue(a.dueDate)}` : formatDue(a.dueDate)) : "No due date"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <CheckCircle2 className="size-10 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">You&apos;re all caught up</p>
                  <p className="text-sm text-muted-foreground">No assignments are waiting on you right now.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-6" aria-labelledby="my-courses-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="my-courses-heading" className="text-lg font-semibold tracking-tight">
            {bundle.offersCourses ? "My Courses" : "My Lessons"}
          </h2>
          <Link
            href="/student/courses"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        {myCourses.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myCourses.map((course) => (
              <Link key={course.id} href={`/student/courses/${course.id}`} className="group">
                <Card className="h-full transition-shadow hover:shadow-card">
                  <CardContent className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium group-hover:text-primary">{course.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[course.subject, course.className].filter(Boolean).join(" · ") ||
                            (bundle.offersCourses ? "Course" : "Lessons")}
                        </p>
                      </div>
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <ProgressBar value={course.overallPercentage} label={`${course.title} progress`} />
                    <p className="text-xs text-muted-foreground">
                      {course.completedLessons} of {course.lessonCount} lessons · {course.overallPercentage}%
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="size-10 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">
                  {bundle.offersCourses ? "No published courses yet" : "No published lessons yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {bundle.offersCourses
                    ? "Courses appear here once your teachers publish them."
                    : "Lessons appear here once your teachers publish them."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {practiceExams.length > 0 && (
        <section className="mt-6" aria-labelledby="practice-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="practice-heading" className="text-lg font-semibold tracking-tight">
              Practice &amp; mock exams
            </h2>
            <Link
              href="/student/exam-series"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {practiceExams.map((series) => (
              <Link key={series.id} href={`/student/exam-series/${series.id}`} className="group">
                <Card className="h-full transition-shadow hover:shadow-card">
                  <CardContent className="grid gap-2 p-4">
                    <p className="truncate font-medium group-hover:text-primary">{series.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {series.questionCount} questions
                      {series.durationMinutes ? ` · ${series.durationMinutes} min` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {series.attempts > 0
                        ? `${series.attempts} ${series.attempts === 1 ? "attempt" : "attempts"} · best ${series.bestScore ?? 0}%`
                        : "Not attempted yet"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Card className="animate-card-enter mt-6" style={{ animationDelay: "360ms" }}>
        <CardHeader>
          <CardTitle>Explore</CardTitle>
          <CardDescription>
            {bundle.offersCourses
              ? "Courses, tests and results at your fingertips."
              : "Lessons, tests and results at your fingertips."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Link href="/student/courses" className="inline-flex">
            <Button variant="outline" className="h-11 w-full justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="size-4" aria-hidden="true" />
                {bundle.offersCourses ? "Browse my courses" : "Browse My Lessons"}
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
          <Link href="/student/report-cards" className="inline-flex sm:col-span-2">
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
    </>
  );
}

export default async function StudentDashboardPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const name = context.profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <DashboardShell title="Dashboard" badge="Student">
      <WelcomeHeader name={name} subtitle="Ready to continue your learning?" />
      <div className="mt-6">
        <Suspense fallback={<StudentDashboardSkeleton />}>
          <StudentDashboardContent />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
