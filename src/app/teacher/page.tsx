import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, ClipboardList, FileText, BarChart3, ArrowRight, Plus, ClipboardCheck, Users, CheckCircle2, School } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getTeacherAnnouncements } from "@/services/announcements";
import { listTeacherAssignments } from "@/services/assignments";
import { getTeacherClassRosters } from "@/services/teacher-classes";
import { getSchoolLevel } from "@/services/schools";
import { levelOffersCourses } from "@/lib/education/levels";
import { AnnouncementBanner } from "@/components/announcements/announcement-banner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerData } from "@/lib/server-cache";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WelcomeHeader } from "@/components/dashboard/welcome-header";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Teacher dashboard",
  robots: { index: false, follow: false },
};

async function getTeacherDashboardBundle() {
  const { schoolId, teacherId, userId, role } = await requireContentEditor();
  return getServerData(`dash:teacher:${schoolId}:${userId}`, 20_000, async () => {
    const admin = createAdminClient();
    const [level, coursesRes, assignmentsRes, assignments, classes, announcements] =
      await Promise.all([
        getSchoolLevel(schoolId),
        teacherId
          ? admin
              .from("courses")
              .select("id, status")
              .eq("school_id", schoolId)
              .eq("teacher_id", teacherId)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] as { id: string; status: string }[], error: null }),
        admin
          .from("assignments")
          .select("id")
          .eq("school_id", schoolId)
          .eq("created_by", userId)
          .is("deleted_at", null),
        listTeacherAssignments(schoolId, userId, role),
        teacherId ? getTeacherClassRosters(schoolId, teacherId) : Promise.resolve([]),
        teacherId ? getTeacherAnnouncements(schoolId, teacherId) : Promise.resolve([]),
      ]);

    const courses = coursesRes.data ?? [];
    return {
      offersCourses: levelOffersCourses(level),
      publishedCount: courses.filter((c) => c.status === "published").length,
      draftCount: courses.length - courses.filter((c) => c.status === "published").length,
      assignmentCount: assignmentsRes.data?.length ?? 0,
      assignments,
      classes,
      announcements,
    };
  });
}

function TeacherDashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCardSkeleton key={i} index={i} />
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="relative h-72 overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <div className="skeleton absolute inset-0" />
          </div>
        ))}
      </div>
    </>
  );
}

async function TeacherDashboardContent() {
  const bundle = await getTeacherDashboardBundle();

  const pendingSubmissions = bundle.assignments.reduce((sum, a) => sum + a.pending, 0);
  const totalStudents = bundle.classes.reduce((sum, c) => sum + c.students.length, 0);
  const grading = bundle.assignments.filter((a) => a.pending > 0).slice(0, 5);

  const subjectOf = (embed: unknown): string | null => {
    if (Array.isArray(embed)) return (embed[0] as { name?: string } | undefined)?.name ?? null;
    if (embed && typeof embed === "object") return (embed as { name?: string }).name ?? null;
    return null;
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {bundle.offersCourses && (
          <StatCard title="Active Courses" value={bundle.publishedCount} icon={BookOpen} href="/teacher/courses" tone="indigo" hint={`${bundle.draftCount} draft`} />
        )}
        <StatCard
          title="Pending Submissions"
          value={pendingSubmissions}
          icon={ClipboardCheck}
          href="/teacher/assignments"
          tone={pendingSubmissions > 0 ? "amber" : "emerald"}
          index={1}
          hint="Awaiting your grade"
        />
        <StatCard title="My Classes" value={bundle.classes.length} icon={Users} href="/teacher/classes" tone="sky" index={2} hint={`${totalStudents} students`} />
        <StatCard title="My Assignments" value={bundle.assignmentCount} icon={ClipboardList} href="/teacher/assignments" tone="fuchsia" index={3} />
      </div>

      <AnnouncementBanner announcements={bundle.announcements} className="mt-5" />

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card className="animate-card-enter" style={{ animationDelay: "220ms" }}>
          <CardHeader>
            <CardTitle>Needs grading</CardTitle>
            <CardDescription>Submissions waiting for your feedback</CardDescription>
          </CardHeader>
          <CardContent>
            {grading.length > 0 ? (
              <ul className="grid gap-2">
                {grading.map((item) => (
                  <li key={item.assignment.id}>
                    <Link
                      href={`/teacher/assignments/${item.assignment.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.assignment.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {subjectOf(item.assignment.subjects)
                            ? `${subjectOf(item.assignment.subjects)} · `
                            : null}
                          {item.pending} submission{item.pending === 1 ? "" : "s"} to grade
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {item.pending}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <CheckCircle2 className="size-10 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">Nothing waiting</p>
                  <p className="text-sm text-muted-foreground">
                    Every submission has been graded. Nice work.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-card-enter" style={{ animationDelay: "300ms" }}>
          <CardHeader>
            <CardTitle>My classes</CardTitle>
            <CardDescription>Classes you teach this term</CardDescription>
          </CardHeader>
          <CardContent>
            {bundle.classes.length > 0 ? (
              <ul className="grid gap-2">
                {bundle.classes.map((c) => (
                  <li key={c.classId}>
                    <Link
                      href="/teacher/classes"
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <School className="size-5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate font-medium">{c.className}</span>
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {c.students.length} student{c.students.length === 1 ? "" : "s"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Users className="size-10 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">No classes assigned yet</p>
                  <p className="text-sm text-muted-foreground">
                    Your school admin assigns you to classes — rosters and submissions appear here.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="animate-card-enter mt-5" style={{ animationDelay: "380ms" }}>
        <CardHeader>
          <CardTitle>Teaching</CardTitle>
          <CardDescription>
            {bundle.offersCourses
              ? "Create and manage your digital courses."
              : "Set work, mark it, and keep an eye on your classes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {bundle.offersCourses && (
            <>
              <Link href="/teacher/courses" className="inline-flex">
                <Button variant="outline" className="h-11 w-full justify-between">
                  <span className="flex items-center gap-2">
                    <BookOpen className="size-4" aria-hidden="true" />
                    Go to my courses
                  </span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/teacher/courses" className="inline-flex">
                <Button className="h-11 w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Plus className="size-4" aria-hidden="true" />
                    Create a new course
                  </span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
            </>
          )}
          <Link href="/teacher/assignments" className="inline-flex">
            <Button variant="outline" className="h-11 w-full justify-between">
              <span className="flex items-center gap-2">
                <ClipboardList className="size-4" aria-hidden="true" />
                Grade submissions
              </span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/teacher/exam-series" className="inline-flex">
            <Button variant="outline" className="h-11 w-full justify-between">
              <span className="flex items-center gap-2">
                <FileText className="size-4" aria-hidden="true" />
                Build exam series
              </span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/teacher/analytics" className="inline-flex sm:col-span-2">
            <Button variant="outline" className="h-11 w-full justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="size-4" aria-hidden="true" />
                Class analytics
              </span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </>
  );
}

export default async function TeacherDashboardPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const name = context.profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <DashboardShell title="Dashboard" badge="Teacher">
      <WelcomeHeader name={name} subtitle="Here's what needs your attention today." />
      <div className="mt-6">
        <Suspense fallback={<TeacherDashboardSkeleton />}>
          <TeacherDashboardContent />
        </Suspense>
      </div>
    </DashboardShell>
  );
}