import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, ClipboardList, FileText, BarChart3, ArrowRight, Plus } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getTeacherAnnouncements } from "@/services/announcements";
import { AnnouncementBanner } from "@/components/announcements/announcement-banner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerData } from "@/lib/server-cache";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Teacher dashboard",
  robots: { index: false, follow: false },
};

async function getTeacherDashboardBundle() {
  const { schoolId, teacherId, userId } = await requireContentEditor();
  return getServerData(`dash:teacher:${schoolId}:${userId}`, 20_000, async () => {
    const admin = createAdminClient();
    const [coursesRes, assignmentsRes, announcements] = await Promise.all([
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
      teacherId ? getTeacherAnnouncements(schoolId, teacherId) : Promise.resolve([]),
    ]);

    const courses = coursesRes.data ?? [];
    return {
      publishedCount: courses.filter((c) => c.status === "published").length,
      draftCount: courses.length - courses.filter((c) => c.status === "published").length,
      assignmentCount: assignmentsRes.data?.length ?? 0,
      announcements,
    };
  });
}

function TeacherDashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <StatCardSkeleton key={i} index={i} />
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="relative h-72 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
            <div className="skeleton absolute inset-0" />
          </div>
        ))}
      </div>
    </>
  );
}

async function TeacherDashboardContent() {
  const bundle = await getTeacherDashboardBundle();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Active Courses" value={bundle.publishedCount} icon={BookOpen} href="/teacher/courses" tone="indigo" hint={`${bundle.draftCount} draft`} />
        <StatCard title="My Assignments" value={bundle.assignmentCount} icon={ClipboardList} href="/teacher/assignments" tone="amber" index={1} />
      </div>

      <AnnouncementBanner announcements={bundle.announcements} className="mt-5" />

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card className="animate-card-enter" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle>Teaching</CardTitle>
            <CardDescription>Create and manage your digital courses.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link href="/teacher/courses" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4" aria-hidden="true" />
                  Go to my courses
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/teacher/courses" className="inline-flex">
              <Button className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="size-4" aria-hidden="true" />
                  Create a new course
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/teacher/assignments" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  Grade submissions
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/teacher/exam-series" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="size-4" aria-hidden="true" />
                  Build exam series
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/teacher/analytics" className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="size-4" aria-hidden="true" />
                  Class analytics
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-card-enter" style={{ animationDelay: "280ms" }}>
          <CardHeader>
            <CardTitle>Next up</CardTitle>
            <CardDescription>Modules arriving in later phases.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The modules on this dashboard are all live — new teaching tools
              arrive with future phases.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default async function TeacherDashboardPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  return (
    <DashboardShell title="Teacher Dashboard" badge="Teacher">
      <Suspense fallback={<TeacherDashboardSkeleton />}>
        <TeacherDashboardContent />
      </Suspense>
    </DashboardShell>
  );
}