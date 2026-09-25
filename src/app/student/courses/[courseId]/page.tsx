import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  GraduationCap,
  PlayCircle,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent, getStudentCourseDetail } from "@/services/learning";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Course",
  robots: { index: false, follow: false },
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export default async function StudentCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const detail = await getStudentCourseDetail(schoolId, studentId, courseId);

  if (!detail.course) {
    return (
      <DashboardShell title="Course not found">
        <p className="text-sm text-muted-foreground">
          This course is not available to you.
        </p>
        <Link href="/student/courses" className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            My courses
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  const course = detail.course;

  const renderLessonList = (
    lessons: (typeof detail.unassignedLessons)[number][],
    prefix?: string,
  ) => (
    <ul className="grid gap-1.5">
      {lessons.map((lesson, index) => {
        const done = lesson.progress?.progress_percentage === 100;
        return (
          <li key={lesson.id}>
            <a href={`/student/courses/${course.id}/lessons/${lesson.id}`}>
              <Card
                className={`transition-colors hover:border-primary/60 hover:bg-muted/40 ${
                  done ? "bg-muted/40" : ""
                }`}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  {done ? (
                    <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {prefix
                        ? `${prefix}${index + 1}. ${lesson.title}`
                        : lesson.title}
                    </p>
                    {lesson.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {lesson.description}
                      </p>
                    )}
                  </div>
                  <PlayCircle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </CardContent>
              </Card>
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <DashboardShell title={course.title} badge="Course">
      <div className="mb-4 flex flex-wrap items-center gap-3">
<Link href="/student/courses" className="inline-flex">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" aria-hidden="true" />
            My courses
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {detail.subject && <Badge variant="secondary">{detail.subject}</Badge>}
            {detail.className && (
              <Badge variant="outline">
                <GraduationCap className="mr-1 size-3" aria-hidden="true" />
                {detail.className}
              </Badge>
            )}
            {detail.teacherName && (
              <span className="text-xs text-muted-foreground">
                Taught by {detail.teacherName}
              </span>
            )}
          </div>
          {course.description && (
            <p className="text-sm text-muted-foreground">{course.description}</p>
          )}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {detail.completedLessons} of {detail.totalLessons} lessons completed
              </span>
              <span className="font-medium text-foreground">
                {detail.overallPercentage}%
              </span>
            </div>
            <ProgressBar value={detail.overallPercentage} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {detail.modules.map((module, moduleIndex) => (
          <section key={module.id}>
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold">
                Module {moduleIndex + 1}: {module.title}
              </h2>
            </div>
            {module.description && (
              <p className="mb-2 text-sm text-muted-foreground">{module.description}</p>
            )}
            {module.lessons.length > 0 ? (
              renderLessonList(module.lessons)
            ) : (
              <p className="text-sm text-muted-foreground">Coming soon.</p>
            )}
          </section>
        ))}

        {detail.unassignedLessons.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Lessons</h2>
            {renderLessonList(detail.unassignedLessons)}
          </section>
        )}

        <Separator />
      </div>
    </DashboardShell>
  );
}