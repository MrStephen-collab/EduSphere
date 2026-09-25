import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpenCheck, CalendarClock, Clock, Layers, MoveUpRight, Trophy } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getStudentExamSeries, examTypeLabels } from "@/services/exam";
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
  title: "Exam series",
  robots: { index: false, follow: false },
};

const examOrder = ["common_entrance", "waec", "neco", "jamb", "school"] as const;

export default async function StudentExamSeriesPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const series = await getStudentExamSeries(schoolId, studentId);
  const sorted = [...series].sort(
    (a, b) => examOrder.indexOf(a.examType) - examOrder.indexOf(b.examType),
  );

  return (
    <DashboardShell title="Exam Series" badge="Student">
      <p className="text-sm text-muted-foreground">
        Practice past questions for Common Entrance, WAEC, NECO and JAMB, plus your
        school&apos;s own papers. Every practice is marked instantly.
      </p>

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={BookOpenCheck}
            title="No exam series available"
            description="Your school hasn't published any past question series for your class yet. Check back soon!"
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{examTypeLabels[s.examType]}</Badge>
                  {s.className && <Badge variant="outline">{s.className}</Badge>}
                </div>
                <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {s.description ?? "No description."}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto grid gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpenCheck className="size-3.5" aria-hidden="true" />
                    {s.questionCount} question{s.questionCount === 1 ? "" : "s"}
                  </span>
                  {s.durationMinutes && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {s.durationMinutes} min
                    </span>
                  )}
                  {s.sectionsCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3.5" aria-hidden="true" />
                      {s.sectionsCount} section{s.sectionsCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {s.year && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      {s.year}
                    </span>
                  )}
                  {s.attempts > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="size-3.5" aria-hidden="true" />
                      Best {s.bestScore != null ? `${s.bestScore} pts` : "n/a"} · {s.attempts} attempt{s.attempts === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <a href={`/student/exam-series/${s.id}`} className="inline-flex">
                  <Button className="w-full" variant={s.attempts > 0 ? "outline" : "default"}>
                    {s.attempts > 0 ? "Practise again" : "Start practicing"}
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