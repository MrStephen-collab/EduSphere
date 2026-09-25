import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Paperclip,
  Video,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent, getStudentLessonView } from "@/services/learning";
import { getYouTubeEmbedUrl } from "@/lib/video";
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
import { LessonContent } from "@/components/learning/lesson-content";
import { MarkCompleteButton } from "@/components/learning/progress-actions";

export const metadata: Metadata = {
  title: "Lesson",
  robots: { index: false, follow: false },
};

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const view = await getStudentLessonView(schoolId, studentId, courseId, lessonId);

  if (!view.course || !view.lesson) {
    return (
      <DashboardShell title="Lesson not available">
        <p className="text-sm text-muted-foreground">
          This lesson isn&apos;t available to you yet.
        </p>
        <a href={`/student/courses/${courseId}`} className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to course
          </Button>
        </a>
      </DashboardShell>
    );
  }

  const course = view.course;
  const lesson = view.lesson;
  const done = view.progress?.progress_percentage === 100;
  const embedUrl = getYouTubeEmbedUrl(lesson.video_url);

  return (
    <DashboardShell title={lesson.title} badge="Lesson">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <a href={`/student/courses/${course.id}`} className="inline-flex">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {course.title}
          </Button>
        </a>
        {view.moduleTitle && <Badge variant="secondary">{view.moduleTitle}</Badge>}
      </div>

      {done && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          You completed this lesson. Well done!
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          {embedUrl ? (
            <Card className="overflow-hidden">
              <div className="aspect-video w-full bg-black">
                <iframe
                  className="size-full"
                  src={embedUrl}
                  title={lesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </Card>
          ) : lesson.video_url ? (
            <Card>
              <CardContent className="flex items-center gap-3 pt-4">
                <Video className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  This video provider isn&apos;t embeddable here.
                  <a
                    href={lesson.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open video <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lesson notes</CardTitle>
            </CardHeader>
            <CardContent>
              <LessonContent content={lesson.content} />
            </CardContent>
          </Card>
        </div>

        <div className="grid h-fit gap-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Paperclip className="size-4 text-primary" aria-hidden="true" />
                Materials
              </CardTitle>
              <CardDescription>Resources for this lesson.</CardDescription>
            </CardHeader>
            <CardContent>
              {view.materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials for this lesson.</p>
              ) : (
                <ul className="grid gap-1.5">
                  {view.materials.map((material) => (
                    <li
                      key={material.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <a
                        href={material.file_url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-center gap-2"
                      >
                        <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate font-medium">{material.title}</span>
                      </a>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 pt-4">
              <MarkCompleteButton
                courseId={course.id}
                lessonId={lesson.id}
                completed={done}
              />
              <div className="grid grid-cols-2 gap-2 border-t pt-3">
                {view.prevLesson ? (
                  <a
                    href={`/student/courses/${course.id}/lessons/${view.prevLesson.id}`}
                    className="inline-flex"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                      Previous
                    </Button>
                  </a>
                ) : (
                  <span />
                )}
                {view.nextLesson ? (
                  <a
                    href={`/student/courses/${course.id}/lessons/${view.nextLesson.id}`}
                    className="inline-flex justify-self-end"
                  >
                    <Button size="sm" className="w-full">
                      Next
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  </a>
                ) : (
                  <a href={`/student/courses/${course.id}`} className="inline-flex justify-self-end">
                    <Button size="sm" variant="secondary" className="w-full">
                      Finish course
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}