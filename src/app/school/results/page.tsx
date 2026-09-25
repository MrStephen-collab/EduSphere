import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Award,
  BarChart3,
  CheckCircle2,
  GraduationCap,
  Trophy,
  TrendingDown,
} from "lucide-react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getSchoolResults, type ClassOrSubjectSummary } from "@/services/school-results";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ResultsFilters } from "@/components/school/results-filters";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Results",
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SchoolResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ class_id?: string; subject_id?: string; examination_id?: string }>;
}) {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [data, classesRes, subjectsRes, examinationsRes] = await Promise.all([
    getSchoolResults(schoolId, {
      classId: params.class_id ?? null,
      subjectId: params.subject_id ?? null,
      examinationId: params.examination_id ?? null,
    }),
    supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("order", { ascending: true }),
    supabase
      .from("subjects")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name", { ascending: true }),
    supabase
      .from("examinations")
      .select("id, title")
      .eq("school_id", schoolId)
      .order("starts_at", { ascending: false }),
  ]);

  const classes = (classesRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  const subjects = (subjectsRes.data ?? []).map((s) => ({ id: s.id, name: s.name }));
  const examinations = (examinationsRes.data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
  }));

  const { rows, total, average, highest, lowest, passRate, byClass, bySubject } = data;

  return (
    <DashboardShell title="Results" badge="School">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Results" value={total} icon={BarChart3} href="/school/results" tone="indigo" hint="In current view" />
        <StatCard title="Average Score" value={average ?? "—"} icon={GraduationCap} href="/school/analytics" tone="emerald" index={1} hint="Across published results" />
        <StatCard title="Pass Rate" value={passRate != null ? `${passRate}%` : "—"} icon={CheckCircle2} href="/school/analytics" tone="rose" index={2} hint="Score of 50% or better" />
        <StatCard title="Highest" value={highest ?? "—"} icon={Trophy} href="/school/analytics" tone="amber" index={3} hint={lowest != null ? `Lowest ${lowest}%` : "No results yet"} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow results by class, subject or examination.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResultsFilters classes={classes} subjects={subjects} examinations={examinations} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By class</CardTitle>
          </CardHeader>
          <CardContent>
            {byClass.length ? (
              <SummaryTable rows={byClass} />
            ) : (
              <p className="text-sm text-muted-foreground">No results in the current view.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By subject</CardTitle>
          </CardHeader>
          <CardContent>
            {bySubject.length ? (
              <SummaryTable rows={bySubject} />
            ) : (
              <p className="text-sm text-muted-foreground">No results in the current view.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Latest results</CardTitle>
          <CardDescription>Showing up to {total} of the most recent published results{params.class_id || params.subject_id || params.examination_id ? " — filters applied" : ""}.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="No results found"
              description="Publish exam results to see them here. Adjust the filters to broaden the view."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Student</th>
                    <th className="py-2 pr-3 font-medium">Class</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">Examination</th>
                    <th className="py-2 pr-3 text-right font-medium">Score</th>
                    <th className="py-2 pr-3 text-right font-medium">%</th>
                    <th className="py-2 pr-3 text-right font-medium">Result</th>
                    <th className="py-2 pr-3 text-right font-medium">Published</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{r.studentName ?? "Student"}</p>
                        {r.admissionNumber && (
                          <p className="text-xs text-muted-foreground">{r.admissionNumber}</p>
                        )}
                      </td>
                      <td className="py-2 pr-3">{r.className ?? "—"}</td>
                      <td className="py-2 pr-3">{r.subject ?? "—"}</td>
                      <td className="py-2 pr-3">{r.examination ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{r.score ?? "—"}</td>
                      <td className="py-2 pr-3 text-right font-medium">{r.percentage != null ? `${r.percentage}%` : "—"}</td>
                      <td className="py-2 pr-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.pass === false || (r.pass == null && r.percentage != null && r.percentage < 50)
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {(r.pass ?? (r.percentage != null && r.percentage >= 50))
                            ? "Pass"
                            : "Fail"}
                          <Award className="size-3" aria-hidden="true" />
                        </span>
                      </td>
                      <td className="py-2 text-right text-xs text-muted-foreground">
                        {formatDate(r.publishedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

function SummaryTable({ rows }: { rows: ClassOrSubjectSummary[] }) {
  return (
    <div className="grid gap-1.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <p className="truncate">{row.label}</p>
          <p className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span>
              {row.count} result{row.count === 1 ? "" : "s"}
            </span>
            <span className="font-medium text-foreground">
              {row.average != null ? `${row.average}%` : "—"}
            </span>
            <span className="w-14 text-right">
              {row.passRate != null ? `${row.passRate}% pass` : ""}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}