import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Library, Paperclip, PlayCircle } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { listTeacherLessons } from "@/services/learning";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "Lessons",
  robots: { index: false, follow: false },
};

/**
 * Every lesson a teacher owns, across all their courses.
 *
 * This page is why the nav's "Courses" and "Lessons" entries no longer point at
 * the same URL. A teacher looking for the lesson they attached a video to used to
 * have to open every course and expand every module; here the video and file
 * counts are on the row, and the row itself opens that lesson's editor.
 */
export default async function TeacherLessonsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId, teacherId } = await requireContentEditor();

  if (!teacherId) {
    return (
      <DashboardShell title="Lessons" badge="Teacher">
        <EmptyState
          icon={Library}
          title="No teacher profile"
          description="Your account is not linked to a teacher record yet, so there are no lessons to show."
        />
      </DashboardShell>
    );
  }

  const lessons = await listTeacherLessons(schoolId, teacherId);

  const withVideo = lessons.filter((l) => l.has_video).length;
  const empty = lessons.filter((l) => l.material_count === 0).length;

  return (
    <DashboardShell title="Lessons" badge="Teacher">
      {lessons.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No lessons yet"
          description="Lessons appear here once you add them to one of your courses. Each row opens that lesson's editor, where you can attach videos and files."
        />
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"} across your courses ·{" "}
            {withVideo} with video
            {empty > 0 ? ` · ${empty} with no materials` : ""}
          </p>

          <ul className="grid gap-2">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{lesson.title}</p>
                        <Badge
                          variant={lesson.status === "published" ? "default" : "outline"}
                        >
                          {lesson.status === "published" ? "Published" : "Draft"}
                        </Badge>
                        {lesson.has_video ? (
                          <Badge variant="outline" className="gap-1">
                            <PlayCircle className="size-3" aria-hidden="true" />
                            Video
                          </Badge>
                        ) : null}
                        {lesson.material_count > 0 ? (
                          <Badge variant="outline" className="gap-1">
                            <Paperclip className="size-3" aria-hidden="true" />
                            {lesson.material_count}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No materials</Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {lesson.course_title}
                        {lesson.description ? ` · ${lesson.description}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/teacher/courses/${lesson.course_id}/lessons/${lesson.id}`}
                        className="inline-flex"
                      >
                        <Button size="sm" variant="outline">
                          Open lesson
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardShell>
  );
}