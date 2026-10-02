import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FolderPlus, Library, ListVideo } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getCourseDetail } from "@/services/learning";
import { getSubjects, getClasses } from "@/services/academics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CourseEditorForm,
  CourseStatusToggle,
  CourseDeleteButton,
  ModuleCreateForm,
  ModuleCard,
  LessonCreateForm,
  LessonRow,
} from "@/components/learning/course-forms";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "Course builder",
  robots: { index: false, follow: false },
};

export default async function TeacherCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId } = await requireContentEditor();

  const [detail, subjects, classes] = await Promise.all([
    getCourseDetail(schoolId, courseId),
    getSubjects(schoolId),
    getClasses(schoolId),
  ]);

  if (!detail.course) {
    return (
      <DashboardShell title="Course not found">
        <p className="text-sm text-muted-foreground">
          This course could not be found or may have been deleted.
        </p>
        <Link href="/teacher/courses" className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to my courses
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  const course = detail.course;
  const totalLessons =
    detail.modules.reduce((sum, m) => sum + m.lessons.length, 0) +
    detail.unassignedLessons.length;

  return (
    <DashboardShell title={course.title} badge="Course builder">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/teacher/courses" className="inline-flex">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" aria-hidden="true" />
            My courses
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <CourseStatusToggle courseId={course.id} status={course.status} />
          <CourseDeleteButton courseId={course.id} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              {asArray(course.subjects)[0]?.name ?? "No subject"} ·{" "}
              {asArray(course.classes)[0]?.name ?? "All classes"} · {totalLessons} lesson
              {totalLessons === 1 ? "" : "s"}
              <span className="mx-2">·</span>
              <Badge variant={course.status === "published" ? "default" : "outline"}>
                {course.status === "published" ? "Published" : "Draft"}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CourseEditorForm
              courseId={course.id}
              initialTitle={course.title}
              initialDescription={course.description}
              initialSubjectId={course.subject_id}
              initialClassId={course.class_id}
              subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderPlus className="size-4 text-primary" aria-hidden="true" />
              Add a module
            </CardTitle>
            <CardDescription>
              Group lessons into topics — e.g. &quot;Quadratic Equations&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ModuleCreateForm courseId={course.id} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <ListVideo className="size-4" aria-hidden="true" />
          Modules &amp; lessons
        </h2>

        {detail.modules.length === 0 && detail.unassignedLessons.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No modules yet. Add your first module above, then start adding lessons.
          </p>
        )}

        {detail.modules.map((module) => (
          <ModuleCard
            key={module.id}
            moduleId={module.id}
            courseId={course.id}
            title={module.title}
            description={module.description}
            lessonCount={module.lessons.length}
          >
            <div className="grid gap-2">
              {module.lessons.length > 0 && (
                <ul className="grid gap-1.5">
                  {/* Each lesson links to its own editor, which is where the video
                      and file uploads live. Without this the lesson title looks
                      clickable but lands back on the course builder, so a teacher
                      cannot get from a lesson name to its video at all. */}
                  {module.lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={{
                        id: lesson.id,
                        title: lesson.title,
                        status: lesson.status,
                        description: lesson.description,
                        materialCount: lesson.materialCount,
                        hasVideo: lesson.hasVideo,
                      }}
                      courseId={course.id}
                      showDelete
                    />
                  ))}
                </ul>
              )}
              <LessonCreateForm courseId={course.id} moduleId={module.id} />
            </div>
          </ModuleCard>
        ))}

        {detail.unassignedLessons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Library className="size-4 text-muted-foreground" aria-hidden="true" />
                Unorganised lessons
              </CardTitle>
              <CardDescription>
                These lessons aren&apos;t in a module yet. Edit a lesson to move it into a module.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ul className="grid gap-1.5">
                {detail.unassignedLessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={{
                      id: lesson.id,
                      title: lesson.title,
                      status: lesson.status,
                      description: lesson.description,
                      materialCount: lesson.materialCount,
                      hasVideo: lesson.hasVideo,
                    }}
                    courseId={course.id}
                    showDelete
                  />
                ))}
              </ul>
              <LessonCreateForm courseId={course.id} />
            </CardContent>
          </Card>
        )}

        <Separator className="my-2" />
      </div>
    </DashboardShell>
  );
}