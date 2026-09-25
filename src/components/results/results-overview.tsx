import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";
import { examTypeLabels } from "@/services/exam";
import type { StudentResults } from "@/services/analytics";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function PercentBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-medium">{value}%</span>
    </div>
  );
}

export function ResultsOverview({
  data,
  footer,
  emptyDescription = "Practice an exam series or complete a graded assignment and your performance will show up here.",
}: {
  data: StudentResults;
  footer?: React.ReactNode;
  emptyDescription?: string;
}) {
  const isEmpty =
    data.overallAverage == null &&
    data.gradedAssignments.length === 0 &&
    data.results.length === 0 &&
    data.practiceAttempts === 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Overall Average"
          value={data.overallAverage != null ? `${data.overallAverage}%` : "—"}
          icon={GraduationCap}
          tone="indigo"
        />
        <StatCard
          title="Practice Average"
          value={data.practiceAverage != null ? `${data.practiceAverage}%` : "—"}
          icon={BookOpenCheck}
          tone="rose"
          index={1}
          hint={`${data.practiceAttempts} attempt${data.practiceAttempts === 1 ? "" : "s"} across ${data.seriesPracticed} series`}
        />
        <StatCard
          title="Course Progress"
          value={data.courseAverage != null ? `${data.courseAverage}%` : "—"}
          icon={BarChart3}
          tone="sky"
          index={2}
        />
        <StatCard
          title="Graded Assignments"
          value={data.gradedAssignments.length}
          icon={ClipboardCheck}
          tone="emerald"
          index={3}
          hint={data.grade ? `Overall grade: ${data.grade}` : "No grade band yet"}
        />
      </div>

      {isEmpty ? (
        <div className="mt-6">
          <EmptyState
            icon={GraduationCap}
            title="No results yet"
            description={emptyDescription}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Performance by subject</CardTitle>
              <CardDescription>
                Combines practice scores and assignment grades.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.subjectPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No scored work yet — your subject breakdown appears after your first practice or graded assignment.
                </p>
              ) : (
                data.subjectPerformance.map((s) => (
                  <div key={s.subject} className="grid gap-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{s.subject}</span>
                      <span>
                        practice {s.practiceAverage ?? "—"}% · assignments {s.assignmentAverage ?? "—"}%
                      </span>
                    </div>
                    <PercentBar value={s.practiceAverage ?? s.assignmentAverage ?? 0} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Practice series</CardTitle>
              <CardDescription>Best score per exam series.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.perSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No exam series practiced yet.
                </p>
              ) : (
                data.perSeries.map((s) => (
                  <div
                    key={s.seriesId}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {examTypeLabels[s.examType as keyof typeof examTypeLabels]} · {s.subject ?? "General"} · {s.attempts} attempt{s.attempts === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {s.best != null ? `${s.best}%` : "—"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Graded assignments</CardTitle>
              <CardDescription>Scored work returned by teachers.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.gradedAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No graded assignments yet.
                </p>
              ) : (
                data.gradedAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.subject ?? "General"} · graded {formatDate(a.gradedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {a.percentage != null ? `${a.percentage}%` : `${a.score} / ${a.maxScore}`}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exam results</CardTitle>
              <CardDescription>Formal results published by the school.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.results.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No formal exam results published yet.
                </p>
              ) : (
                data.results.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.subject ?? "General"}</p>
                      <p className="text-xs text-muted-foreground">Published {formatDate(r.publishedAt)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {r.percentage != null ? `${r.percentage}%` : r.score != null ? String(r.score) : "—"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {footer && <div className="lg:col-span-2">{footer}</div>}
        </div>
      )}
    </>
  );
}