import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen, UsersRound } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getParentChildren, requireParent, resolveChild } from "@/services/parent";
import { getStudentCourses } from "@/services/learning";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChildPicker } from "@/components/parent/child-picker";

export const metadata: Metadata = {
  title: "Child progress",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ParentProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child: childParam } = await searchParams;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("PARENT")) redirect("/dashboard");

  const { schoolId, parentId } = await requireParent();
  const children = await getParentChildren(schoolId, parentId);
  const child = resolveChild(children, childParam);

  if (!child) {
    return (
      <DashboardShell title="Child Progress" badge="Parent">
        <EmptyState
          icon={UsersRound}
          title="No children linked yet"
          description="Children linked to your account will appear here. Ask your school to link your account."
        />
      </DashboardShell>
    );
  }

  const courses = await getStudentCourses(schoolId, child.studentId);

  return (
    <DashboardShell title="Child Progress" badge="Parent">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{child.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {child.className ?? "No class"}
              {child.streamName ? ` · ${child.streamName}` : ""}
            </p>
          </div>
          <ChildPicker options={children} childId={child.studentId} />
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses enrolled yet"
            description="Published courses for your child's class will appear here with lesson progress."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 font-semibold">{course.title}</h3>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {course.subject ?? "General"}
                        {course.className ? ` · ${course.className}` : ""}
                      </p>
                    </div>
                    <Badge variant={course.overallPercentage >= 100 ? "default" : "secondary"}>
                      {course.overallPercentage}%
                    </Badge>
                  </div>
                  <div className="grid gap-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, course.overallPercentage)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {course.completedLessons} of {course.lessonCount} lesson
                      {course.lessonCount === 1 ? "" : "s"} completed
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}