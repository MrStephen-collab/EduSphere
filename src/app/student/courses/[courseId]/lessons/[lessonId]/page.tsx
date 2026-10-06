import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Lock,
  Paperclip,
  Video,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent, getStudentLessonView } from "@/services/learning";
import { getStudentLearningAccess } from "@/services/fee-access";
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
import { MaterialViewer } from "@/components/learning/material-viewer";
import { FeeGateNotice } from "@/components/learning/fee-gate-notice";
import { isRestrictedMaterial } from "@/lib/material-types";

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
  const access = await getStudentLearningAccess(schoolId, studentId);

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
  // Materials withheld, but the lesson itself stays readable: the student can see
  // what they are missing and how far through the course they are, which is the
  // difference between a school holding a balance and a student feeling punished.
  // The refusal that actually matters is in authorizeMaterialRead, so this is the
  // half that makes it legible rather than the half that enforces it.
  const materialsLocked = access.gateActive && !access.allowed;

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

      <FeeGateNotice access={access} className="mb-4" />

      {done && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          You completed this lesson. Well done!
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          {materialsLocked ? (
            <Card>
              <CardContent className="flex items-center gap-3 pt-4">
                <Lock className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  This lesson&apos;s video opens once your fees are on track.
                </p>
              </CardContent>
            </Card>
          ) : embedUrl ? (
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
            </CardHeader>            <CardContent>
              {view.materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials for this lesson.</p>
              ) : materialsLocked ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="size-4" aria-hidden="true" />
                  {view.materials.length} material
                  {view.materials.length === 1 ? "" : "s"} held until your fees are on track.
                </p>
              ) : (
                <div className="grid gap-2">
                  {view.materials.map((material) => (
                    <MaterialViewer
                      key={material.id}
                      material={{
                        id: material.id,
                        title: material.title,
                        fileType: material.file_type,
                        fileSize: material.file_size === null ? null : Number(material.file_size),
                        restricted: isRestrictedMaterial(material.file_type),
                        provider: material.provider ?? null,
                      }}
                    />
                  ))}
                </div>
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