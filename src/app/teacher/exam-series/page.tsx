import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpenText, CalendarClock, Clock, Layers, MoveUpRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { listExamSeries, examTypeLabels } from "@/services/exam";
import { getSubjects, getClasses } from "@/services/academics";
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
  SeriesCreateForm,
  SeriesStatusToggle,
  SeriesDeleteButton,
} from "@/components/exam/series-forms";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "Exam series",
  robots: { index: false, follow: false },
};

export default async function TeacherExamSeriesPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId, userId, role } = await requireContentEditor();

  const [items, subjects, classes] = await Promise.all([
    listExamSeries(schoolId, userId, role),
    getSubjects(schoolId),
    getClasses(schoolId),
  ]);

  return (
    <DashboardShell title="Exam Series" badge="Teacher">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Create exam series</CardTitle>
            <CardDescription>
              Make a past question series for Common Entrance, WAEC, NECO, JAMB or your
              own school format. Add questions and publish for students to practice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeriesCreateForm
              subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {items.length === 0 ? (
            <EmptyState
              icon={BookOpenText}
              title="No exam series yet"
              description="Build a catalogue of past questions for national exams and your own subject papers. Start with the create form, add questions, then publish for students to practice."
            />
          ) : (
            <div className="grid gap-3">
              {items.map(({ series, questionCount }) => (
                <Card key={series.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{series.title}</h3>
                        <Badge variant="secondary">{examTypeLabels[series.exam_type]}</Badge>
                        <Badge variant={series.status === "published" ? "default" : "outline"}>
                          {series.status === "published" ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {series.classes?.name && <span>{series.classes.name}</span>}
                        {series.subjects?.name && <span>{series.subjects.name}</span>}
                        {series.year && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" aria-hidden="true" />
                            {series.year}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Layers className="size-3.5" aria-hidden="true" />
                          {questionCount} question{questionCount === 1 ? "" : "s"}
                        </span>
                        {series.duration_minutes && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden="true" />
                            {series.duration_minutes} min timed
                          </span>
                        )}
                        {series.shuffle_questions && (
                          <span>Shuffled</span>
                        )}
                      </div>
                      {series.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{series.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <SeriesStatusToggle seriesId={series.id} status={series.status} />
                      <Link href={`/teacher/exam-series/${series.id}`} className="inline-flex">
                        <Button size="sm" variant="outline">
                          Manage
                          <MoveUpRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      </Link>
                      <SeriesDeleteButton seriesId={series.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}