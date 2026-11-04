import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";
import { cn } from "cn";
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

/** Green when strong, amber on the fence, rose when it needs work. */
function scoreTone(value: number): string {
  if (value >= 75) return "from-emerald-500 to-teal-500";
  if (value >= 50) return "from-amber-500 to-orange-500";
  return "from-rose-500 to-pink-500";
}

function PercentBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r", scoreTone(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums">
        {value}%
      </span>
    </div>
  );
}

function ScoreChip({
  children,
  tone = "primary",
}: {
  children: React.ReactNode;
  tone?: "primary" | "emerald" | "fuchsia" | "violet";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
      {children}
    </p>
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
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          title="Overall Average"
          value={data.overallAverage != null ? `${data.overallAverage}%` : "—"}
          icon={GraduationCap}
          tone="indigo"
          dense
        />
        <StatCard
          title="Practice Average"
          value={data.practiceAverage != null ? `${data.practiceAverage}%` : "—"}
          icon={BookOpenCheck}
          tone="rose"
          index={1}
          dense
          hint={`${data.practiceAttempts} attempt${data.practiceAttempts === 1 ? "" : "s"} across ${data.seriesPracticed} series`}
        />
        <StatCard
          title="Course Progress"
          value={data.courseAverage != null ? `${data.courseAverage}%` : "—"}
          icon={BarChart3}
          tone="sky"
          index={2}
          dense
        />
        <StatCard
          title="Graded Assignments"
          value={data.gradedAssignments.length}
          icon={ClipboardCheck}
          tone="emerald"
          index={3}
          dense
          hint={data.grade ? `Overall grade: ${data.grade}` : "No grade band yet"}
        />
      </div>

      {isEmpty ? (
        <div className="mt-4">
          <EmptyState
            icon={GraduationCap}
            title="No results yet"
            description={emptyDescription}
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card tone="indigo">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Performance by subject</CardTitle>
              <CardDescription className="text-xs">
                Combines practice scores and assignment grades.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              {data.subjectPerformance.length === 0 ? (
                <EmptyLine>
                  No scored work yet — your subject breakdown appears after your
                  first practice or graded assignment.
                </EmptyLine>
              ) : (
                data.subjectPerformance.map((s) => (
                  <div key={s.subject} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-medium">{s.subject}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        practice {s.practiceAverage ?? "—"}% · assignments{" "}
                        {s.assignmentAverage ?? "—"}%
                      </span>
                    </div>
                    <PercentBar value={s.practiceAverage ?? s.assignmentAverage ?? 0} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card tone="sky">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Practice series</CardTitle>
              <CardDescription className="text-xs">Best score per exam series.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              {data.perSeries.length === 0 ? (
                <EmptyLine>No exam series practiced yet.</EmptyLine>
              ) : (
                data.perSeries.map((s) => (
                  <div
                    key={s.seriesId}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{s.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {examTypeLabels[s.examType as keyof typeof examTypeLabels]} ·{" "}
                        {s.subject ?? "General"} · {s.attempts} attempt
                        {s.attempts === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ScoreChip tone="fuchsia">
                      {s.best != null ? `${s.best}%` : "—"}
                    </ScoreChip>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card tone="emerald">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Graded assignments</CardTitle>
              <CardDescription className="text-xs">
                Scored work returned by teachers.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              {data.gradedAssignments.length === 0 ? (
                <EmptyLine>No graded assignments yet.</EmptyLine>
              ) : (
                data.gradedAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{a.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {a.subject ?? "General"} · graded {formatDate(a.gradedAt)}
                      </p>
                    </div>
                    <ScoreChip tone="emerald">
                      {a.percentage != null ? `${a.percentage}%` : `${a.score} / ${a.maxScore}`}
                    </ScoreChip>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card tone="violet">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Exam results</CardTitle>
              <CardDescription className="text-xs">
                Formal results published by the school.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              {data.results.length === 0 ? (
                <EmptyLine>No formal exam results published yet.</EmptyLine>
              ) : (
                data.results.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{r.subject ?? "General"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        Published {formatDate(r.publishedAt)}
                      </p>
                    </div>
                    <ScoreChip tone="violet">
                      {r.percentage != null
                        ? `${r.percentage}%`
                        : r.score != null
                          ? String(r.score)
                          : "—"}
                    </ScoreChip>
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
