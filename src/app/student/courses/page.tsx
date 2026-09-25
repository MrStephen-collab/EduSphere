import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen, GraduationCap, MoveUpRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent, getStudentCourses } from "@/services/learning";
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
  title: "My courses",
  robots: { index: false, follow: false },
};

function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className ?? ""}`}>
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export default async function StudentCoursesPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const courses = await getStudentCourses(schoolId, studentId);

  return (
    <DashboardShell title="My Courses" badge="Student">
      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Your school hasn't published any courses for your class yet. Check back soon!"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  {course.subject && <Badge variant="secondary">{course.subject}</Badge>}
                  {course.className && (
                    <Badge variant="outline">
                      <GraduationCap className="mr-1 size-3" aria-hidden="true" />
                      {course.className}
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-2 text-base">{course.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {course.description ?? "No description."}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto grid gap-3">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {course.completedLessons} of {course.lessonCount} lessons
                    </span>
                    <span className="font-medium text-foreground">
                      {course.overallPercentage}%
                    </span>
                  </div>
                  <ProgressBar value={course.overallPercentage} />
                </div>
                <a href={`/student/courses/${course.id}`} className="inline-flex">
                  <Button className="w-full" variant={course.overallPercentage > 0 ? "outline" : "default"}>
                    {course.overallPercentage > 0 ? "Continue learning" : "Start learning"}
                    <MoveUpRight className="size-4" aria-hidden="true" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}