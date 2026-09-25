import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getReportOptions, getStudentReport } from "@/services/report-cards";
import type { ReportOptions } from "@/services/report-cards";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportFilters } from "@/components/report/report-filters";
import { ReportCardPaper } from "@/components/report/report-card-paper";
import { PrintButton } from "@/components/report/print-button";

export const metadata: Metadata = {
  title: "Annual report card",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function resolveSession(options: ReportOptions, sessionId: string | null | undefined) {
  return (
    options.sessions.find((s) => s.id === sessionId) ??
    options.sessions.find((s) => s.is_current) ??
    options.sessions[0] ??
    null
  );
}

export default async function StudentAnnualReportPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionParam } = await searchParams;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const options = await getReportOptions(schoolId);
  const session = resolveSession(options, sessionParam);

  if (!options.sessions.length || !session) {
    return (
      <DashboardShell title="Annual Report Card" badge="Student">
        <p className="text-sm text-muted-foreground">
          No academic sessions have been set up yet — ask your school to create one.
        </p>
      </DashboardShell>
    );
  }

  const report = await getStudentReport(schoolId, studentId, { kind: "session", session });

  const termHref = `/student/report-cards?session=${session.id}`;

  return (
    <DashboardShell title="Annual Report Card" badge="Student">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ReportFilters
            sessions={options.sessions.map((s) => ({
              id: s.id,
              name: s.name,
              isCurrent: s.is_current,
              terms: s.terms.map((t) => ({
                id: t.id,
                name: t.name,
                isCurrent: t.is_current,
              })),
            }))}
            sessionId={session.id}
            view="annual"
          />
          <div className="flex items-center gap-2 print:hidden">
            <Link href={termHref} className="inline-flex">
              <Button variant="outline">
                <BarChart3 className="size-4" aria-hidden="true" />
                Term view
              </Button>
            </Link>
            {report && <PrintButton />}
          </div>
        </div>

        {report ? (
          <ReportCardPaper report={report} />
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Your annual report card could not be generated — check that you are enrolled in a class.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}