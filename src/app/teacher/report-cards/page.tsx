import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { requireContentEditor } from "@/services/shared";
import { getClassReport, getReportOptions } from "@/services/report-cards";
import type { ReportOptions } from "@/services/report-cards";
import type { Term } from "@/types/database";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportFilters } from "@/components/report/report-filters";
import { ClassReportSheet } from "@/components/report/class-report-sheet";
import { PrintButton } from "@/components/report/print-button";

export const metadata: Metadata = {
  title: "Report cards",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function resolveClass(
  options: ReportOptions,
  classId: string | null | undefined,
) {
  return (
    options.classes.find((c) => c.id === classId) ?? options.classes[0] ?? null
  );
}

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

export default async function TeacherReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; session?: string; term?: string; view?: string }>;
}) {
  const { class: classParam, session: sessionParam, term: termParam, view } = await searchParams;
  const annual = view === "annual";

  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (editor.role !== "TEACHER" && editor.role !== "SCHOOL_ADMIN" && editor.role !== "SCHOOL_OWNER") {
    redirect("/dashboard");
  }

  const teacherId = editor.role === "TEACHER" ? editor.teacherId : null;
  const options = await getReportOptions(editor.schoolId, teacherId);

  if (!options.classes.length) {
    return (
      <DashboardShell title="Report Cards" badge="Teacher">
        <p className="text-sm text-muted-foreground">
          No classes assigned yet — ask your school admin to link you to a class.
        </p>
      </DashboardShell>
    );
  }

  const cls = resolveClass(options, classParam);
  const session = resolveSession(options, sessionParam);
  const term = resolveTerm(session, termParam);

  if (!session || (!annual && !term)) {
    return (
      <DashboardShell title="Report Cards" badge="Teacher">
        <p className="text-sm text-muted-foreground">
          This session has no terms yet — add a term to generate report cards.
        </p>
      </DashboardShell>
    );
  }

  const scope = annual
    ? { kind: "session" as const, session }
    : { kind: "term" as const, term: term! };
  const report = await getClassReport(editor.schoolId, cls.id, scope, { teacherId });

  const termHref = `/teacher/report-cards?class=${cls.id}&session=${session.id}&view=term`;
  const annualHref = `/teacher/report-cards?class=${cls.id}&session=${session.id}&view=annual`;

  return (
    <DashboardShell title="Report Cards" badge="Teacher">
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
            classes={options.classes}
            sessionId={session.id}
            termId={annual ? undefined : term?.id}
            classId={cls.id}
            view={annual ? "annual" : "term"}
          />
          <div className="flex items-center gap-2 print:hidden">
            <Link href={annual ? termHref : annualHref} className="inline-flex">
              <Button variant="outline">
                <ScrollText className="size-4" aria-hidden="true" />
                {annual ? "Term view" : "Annual view"}
              </Button>
            </Link>
            {report && <PrintButton label="Print sheet" />}
          </div>
        </div>

        {report ? (
          <ClassReportSheet report={report} />
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                This report is not available for your account.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}