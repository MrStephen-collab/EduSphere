import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  CheckCircle2,
  UsersRound,
  GraduationCap,
  BookOpen,
  BookMarked,
  ClipboardList,
  FileText,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { planFeatureEnabled } from "@/services/entitlements";
import { getSchoolAnalytics } from "@/services/analytics";
import { resolveAnalyticsRange } from "@/lib/analytics-period";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlanRequiredCard } from "@/components/billing/plan-required";
import { StatCard } from "@/components/dashboard/stat-card";
import { AnalyticsFilters } from "@/components/school/analytics-filters";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export const metadata: Metadata = {
  title: "School analytics",
  robots: { index: false, follow: false },
};

function Bar({ label, value, sub, color }: { label: string; value: number; sub: string; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 text-muted-foreground">
          {Math.round(value)}% · {sub}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full ${color ?? "bg-primary"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export default async function SchoolAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  if (!(await planFeatureEnabled(schoolId, "analytics"))) {
    return (
      <DashboardShell title="School Analytics" badge="Admin">
        <PlanRequiredCard
          feature="Analytics"
          description="Your school's plan doesn't include analytics dashboards. Upgrade your plan to see school-wide performance."
          href="/school/billing"
        />
      </DashboardShell>
    );
  }

  const params = await searchParams;
  const range = resolveAnalyticsRange({
    period: params.period,
    from: params.from,
    to: params.to,
  });

  const data = await getSchoolAnalytics(schoolId, { from: range.from, to: range.to });

  return (
    <DashboardShell title="School Analytics" badge="Admin">
      <div className="grid gap-4">
        <Card>
          <CardContent className="pt-6">
            <AnalyticsFilters activeLabel={range.label} />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            title="School average"
            value={data.averagePercentage != null ? `${data.averagePercentage}%` : "—"}
            tone="indigo"
            hint={`${data.scoredResults} scored result${data.scoredResults === 1 ? "" : "s"}`}
          />
          <StatCard
            icon={CheckCircle2}
            title="Pass rate"
            value={data.passRate != null ? `${data.passRate}%` : "—"}
            tone="emerald"
            index={1}
          />
          <StatCard
            icon={UsersRound}
            title="Active students"
            value={`${data.activeStudentCount}/${data.studentCount}`}
            tone="sky"
            index={2}
            href="/school/students"
            hint="Scored in this period"
          />
          <StatCard icon={GraduationCap} title="Classes" value={data.classCount} tone="amber" index={3} href="/school/classes" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={GraduationCap} title="Teachers" value={data.teacherCount} tone="indigo" index={4} href="/school/teachers" />
          <StatCard icon={BookOpen} title="Courses" value={data.courseCount} tone="emerald" index={5} />
          <StatCard icon={BookMarked} title="Lessons" value={data.lessonCount} tone="sky" index={6} />
          <StatCard icon={ClipboardList} title="Assignments" value={data.assignmentCount} tone="amber" index={7} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={FileText} title="Examinations" value={data.examinationCount} tone="fuchsia" index={8} />
        </div>

        <CollapsibleSection
          title="Class averages"
          description="Average score for every class in this period."
          defaultOpen
        >
          <Card>
            <CardContent>
              {data.classAverages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No published results yet.</p>
              ) : (
                <div className="grid gap-3">
                  {data.classAverages.map((c) => (
                    <Bar key={c.classId ?? "none"} label={c.className} value={c.average} sub={`${c.results} result${c.results === 1 ? "" : "s"}`} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          title="Subject averages"
          description="Average score for every subject in this period."
        >
          <Card>
            <CardContent>
              {data.subjectAverages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subject results yet.</p>
              ) : (
                <div className="grid gap-3">
                  {data.subjectAverages.map((s) => (
                    <Bar key={s.subjectId} label={s.subjectName} value={s.average} sub={`${s.results} result${s.results === 1 ? "" : "s"}`} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          title="Weak topics"
          description="Where students are losing the most marks."
        >
          <Card>
            <CardContent>
              {data.weakTopics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough topic-level answers yet. Topic performance appears once students
                  answer enough questions.
                </p>
              ) : (
                <div className="grid gap-3">
                  {data.weakTopics.map((t) => (
                    <Bar key={t.topic} label={t.topic} value={t.average} sub={`${t.answers} answer${t.answers === 1 ? "" : "s"}`} color="bg-amber-500" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          title="Top students"
          description="Highest averages in this period."
        >
          <Card>
            <CardContent>
              {data.topStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No student results yet.</p>
              ) : (
                <div className="grid gap-2">
                  {data.topStudents.map((s, i) => (
                    <div key={s.studentId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-5 shrink-0 text-muted-foreground">{i + 1}.</span>
                        <span className="truncate font-medium">{s.displayName}</span>
                        {s.className && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {s.className}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {s.average}% · {s.results} result{s.results === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleSection>

        {data.strongTopics.length > 0 && (
          <CollapsibleSection
            title="Strongest topics"
            description="Where students are performing best."
          >
            <Card>
              <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.strongTopics.map((t) => (
                  <Bar key={t.topic} label={t.topic} value={t.average} sub={`${t.answers} answer${t.answers === 1 ? "" : "s"}`} color="bg-emerald-500" />
                ))}
              </div>
              </CardContent>
            </Card>
          </CollapsibleSection>
        )}
      </div>
    </DashboardShell>
  );
}