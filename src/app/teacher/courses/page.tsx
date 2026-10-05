import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ListTree, MoveUpRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { listCourses } from "@/services/learning";
import { getSubjects, getClasses } from "@/services/academics";
import { getSchoolLevel } from "@/services/schools";
import { contentCategoriesForLevel } from "@/lib/content-categories";
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
import {
  CourseCreateForm,
  CourseStatusToggle,
  CourseDeleteButton,
  ContentCategoryBadge,
} from "@/components/learning/course-forms";
import { EmptyState } from "@/components/dashboard/empty-state";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "My courses",
  robots: { index: false, follow: false },
};

export default async function TeacherCoursesPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId, teacherId } = await requireContentEditor();

  const [courses, subjects, classes, level] = await Promise.all([
    listCourses(schoolId),
    getSubjects(schoolId),
    getClasses(schoolId),
    getSchoolLevel(schoolId),
  ]);

  const mine = courses.filter((c) => c.teacher_id === teacherId);
  const categories = contentCategoriesForLevel(level);

  return (
    <DashboardShell title="My Courses" badge="Teacher">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Create course</CardTitle>
            <CardDescription>
              Courses bundle modules and lessons. Publish to make them visible to students.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CourseCreateForm
              subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              categories={categories}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {mine.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Create your first course using the form. Then add modules and lessons to start teaching digitally."
            />
          ) : (
            <div className="grid gap-3">
              {mine.map((course) => {
                const lessonCount = course.lessons?.length ?? 0;
                const moduleCount = course.course_modules?.length ?? 0;
                return (
                  <Card key={course.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{course.title}</h3>
                          <ContentCategoryBadge category={course.content_type} />
                          <Badge variant={course.status === "published" ? "default" : "outline"}>
                            {course.status === "published" ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {asArray(course.subjects)[0]?.name && (
                            <span>{asArray(course.subjects)[0]?.name}</span>
                          )}
                          {asArray(course.classes)[0]?.name && (
                            <span>{asArray(course.classes)[0]?.name}</span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <ListTree className="size-3.5" aria-hidden="true" />
                            {moduleCount} module{moduleCount === 1 ? "" : "s"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="size-3.5" aria-hidden="true" />
                            {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        {course.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <CourseStatusToggle courseId={course.id} status={course.status} />
                        <Link
                          href={`/teacher/courses/${course.id}`}
                          className="inline-flex"
                        >
                          <Button size="sm" variant="outline">
                            Open
                            <MoveUpRight className="size-3.5" aria-hidden="true" />
                          </Button>
                        </Link>
                        <CourseDeleteButton courseId={course.id} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}