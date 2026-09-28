import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Lock, Paperclip } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getLessonForEditor } from "@/services/learning";
import { getCourseDetail } from "@/services/learning";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LessonEditForm,
  LessonDeleteButton,
  MaterialChip,
} from "@/components/learning/course-forms";
import { MaterialUploader } from "@/components/learning/material-uploader";
import { isRestrictedMaterial } from "@/lib/material-types";
import { deleteMaterialAction } from "@/app/teacher/actions";

export const metadata: Metadata = {
  title: "Lesson editor",
  robots: { index: false, follow: false },
};

export default async function TeacherLessonEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId } = await requireContentEditor();

  const [{ lesson, course }, detail] = await Promise.all([
    getLessonForEditor(schoolId, lessonId),
    getCourseDetail(schoolId, courseId),
  ]);

  if (!lesson || !course || course.id !== courseId) {
    return (
      <DashboardShell title="Lesson not found">
        <p className="text-sm text-muted-foreground">
          This lesson could not be found or may have been deleted.
        </p>
        <a href={`/teacher/courses/${courseId}`} className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to course
          </Button>
        </a>
      </DashboardShell>
    );
  }

  const modules = detail.modules.map((m) => ({ id: m.id, title: m.title }));
  const materials = lesson.lesson_materials ?? [];

  return (
    <DashboardShell title={lesson.title} badge="Lesson">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <a href={`/teacher/courses/${course.id}`} className="inline-flex">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {course.title}
          </Button>
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={lesson.status === "published" ? "default" : "outline"}>
            {lesson.status === "published" ? "Published" : "Draft"}
          </Badge>
          <LessonDeleteButton lessonId={lesson.id} courseId={course.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson content</CardTitle>
          <CardDescription>
            Title, video, notes and status. Students only see published lessons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonEditForm
            lessonId={lesson.id}
            courseId={course.id}
            initial={{
              title: lesson.title,
              description: lesson.description,
              content: lesson.content,
              videoUrl: lesson.video_url,
              moduleId: lesson.module_id,
              status: lesson.status,
            }}
            modules={modules}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="size-4 text-primary" aria-hidden="true" />
            Learning materials
          </CardTitle>
          <CardDescription>
            Documents, PDFs, video, audio and links students can open alongside this lesson.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {materials.length > 0 ? (
            <ul className="grid gap-1.5">
              {materials.map((material) => (
                <li key={material.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <MaterialChip
                      material={{
                        id: material.id,
                        title: material.title,
                        file_type: material.file_type,
                        file_url: material.file_url,
                      }}
                      lessonId={lesson.id}
                      courseId={course.id}
                      onDelete={(id) => deleteMaterialAction(id, lesson.id, course.id)}
                    />
                  </div>
                  {isRestrictedMaterial(material.file_type) ? (
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <Lock className="size-3" aria-hidden="true" />
                      Locked
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No materials yet. Add files or links below.
            </p>
          )}

          <MaterialUploader lessonId={lesson.id} courseId={course.id} />

          {materials.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <ExternalLink className="mr-1 inline size-3.5" aria-hidden="true" />
              Audio and video are marked locked. They are stored privately and only play through a
              link signed to each student.
            </p>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}