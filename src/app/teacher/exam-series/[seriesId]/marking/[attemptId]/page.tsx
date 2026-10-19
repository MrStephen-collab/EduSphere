import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Monitor, ShieldAlert } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getAttemptForMarking } from "@/services/exam";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkingForm } from "@/components/exam/marking-form";
import { suspiciousEventLabels } from "@/lib/exam-security";

export const metadata: Metadata = {
  title: "Mark attempt",
  robots: { index: false, follow: false },
};

export default async function TeacherSeriesMarkingAttemptPage({
  params,
}: {
  params: Promise<{ seriesId: string; attemptId: string }>;
}) {
  const { seriesId, attemptId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId } = await requireContentEditor();
  const attempt = await getAttemptForMarking(schoolId, seriesId, attemptId);

  if (!attempt) {
    return (
      <DashboardShell title="Attempt not found">
        <p className="text-sm text-muted-foreground">
          This attempt doesn&apos;t exist or isn&apos;t part of this series.
        </p>
        <Link href={`/teacher/exam-series/${seriesId}/marking`} className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to marking
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={`Mark ${attempt.studentName}`}>
      <div className="grid gap-4">
        {(attempt.suspiciousActivity.length > 0 || attempt.deviceSummary) && (
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <ShieldAlert
                  className={`size-4 ${attempt.flagged ? "text-destructive" : "text-amber-600"}`}
                  aria-hidden="true"
                />
                Exam integrity
                {attempt.flagged && <Badge variant="destructive">Flagged for review</Badge>}
              </CardTitle>
              <CardDescription>
                A browser-level record kept while this paper was open. It is evidence of what the
                browser reported — not proof of cheating. Judge it alongside the answers.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {attempt.deviceSummary && (
                <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Monitor className="size-3.5 shrink-0" aria-hidden="true" />
                  {attempt.deviceSummary}
                </p>
              )}
              {attempt.suspiciousActivity.length === 0 ? (
                <p className="text-muted-foreground">No integrity events were recorded.</p>
              ) : (
                <ul className="grid gap-1">
                  {attempt.suspiciousActivity.map((event) => (
                    <li
                      key={`${event.type}-${event.at}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
                    >
                      <span>
                        {suspiciousEventLabels[event.type] ?? event.type}
                        {event.detail ? ` (${event.detail})` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(event.at).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <MarkingForm attempt={attempt} />
      </div>
    </DashboardShell>
  );
}