import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  CheckCircle2,
  UsersRound,
  GraduationCap,
  BookOpenCheck,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getSchoolAnalytics } from "@/services/analytics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default async function SchoolAnalyticsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const data = await getSchoolAnalytics(schoolId);

  return (
    <DashboardShell title="School Analytics" badge="Admin">
      <div className="grid gap-4">
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
          <StatCard icon={UsersRound} title="Students" value={data.studentCount} tone="sky" index={2} href="/school/students" />
          <StatCard icon={GraduationCap} title="Classes" value={data.classCount} tone="amber" index={3} href="/school/classes" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                <GraduationCap className="size-4" aria-hidden="true" />
                Class averages
              </CardTitle>
            </CardHeader>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                <BookOpenCheck className="size-4" aria-hidden="true" />
                Subject averages
              </CardTitle>
            </CardHeader>
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
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4" aria-hidden="true" />
                Weak topics
              </CardTitle>
            </CardHeader>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                <Trophy className="size-4" aria-hidden="true" />
                Top students
              </CardTitle>
            </CardHeader>
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
        </div>

        {data.strongTopics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                <TrendingUp className="size-4" aria-hidden="true" />
                Strongest topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.strongTopics.map((t) => (
                  <Bar key={t.topic} label={t.topic} value={t.average} sub={`${t.answers} answer${t.answers === 1 ? "" : "s"}`} color="bg-emerald-500" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}