import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getReportOptions, getStudentReport } from "@/services/report-cards";
import type { ReportOptions } from "@/services/report-cards";
import type { Term } from "@/types/database";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportFilters } from "@/components/report/report-filters";
import { ReportCardPaper } from "@/components/report/report-card-paper";
import { PrintButton } from "@/components/report/print-button";

export const metadata: Metadata = {
  title: "Report cards",
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

function resolveTerm(
  session: { terms: Term[] } | null,
  termId: string | null | undefined,
): Term | null {
  if (!session) return null;
  return (
    session.terms.find((t) => t.id === termId) ??
    session.terms.find((t) => t.is_current) ??
    session.terms[0] ??
    null
  );
}

export default async function StudentReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; term?: string }>;
}) {
  const { session: sessionParam, term: termParam } = await searchParams;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const options = await getReportOptions(schoolId);
  const session = resolveSession(options, sessionParam);
  const term = resolveTerm(session, termParam);

  if (!options.sessions.length) {
    return (
      <DashboardShell title="Report Cards" badge="Student">
        <p className="text-sm text-muted-foreground">
          No academic sessions have been set up yet — ask your school to create one.
        </p>
      </DashboardShell>
    );
  }

  if (!session || !term) {
    return (
      <DashboardShell title="Report Cards" badge="Student">
        <p className="text-sm text-muted-foreground">
          This session has no terms yet — report cards appear once a term is added.
        </p>
      </DashboardShell>
    );
  }

  const report = await getStudentReport(schoolId, studentId, { kind: "term", term });

  const annualHref = `/student/report-cards/annual?session=${session.id}`;

  return (
    <DashboardShell title="Report Cards" badge="Student">
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
            termId={term.id}
            view="term"
          />
          <div className="flex items-center gap-2 print:hidden">
            <Link href={annualHref} className="inline-flex">
              <Button variant="outline">
                <FileText className="size-4" aria-hidden="true" />
                Annual view
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
                Your report card could not be generated — check that you are enrolled in a class.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}