import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, FileText, UsersRound } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getParentChildren, requireParent, resolveChild } from "@/services/parent";
import { getReportOptions, getStudentReport } from "@/services/report-cards";
import type { ReportOptions } from "@/services/report-cards";
import type { Term } from "@/types/database";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ChildPicker } from "@/components/parent/child-picker";
import { ReportFilters } from "@/components/report/report-filters";
import { ReportCardPaper } from "@/components/report/report-card-paper";
import { PrintButton } from "@/components/report/print-button";

export const metadata: Metadata = {
  title: "Child report cards",
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

export default async function ParentReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; session?: string; term?: string; view?: string }>;
}) {
  const { child: childParam, session: sessionParam, term: termParam, view } = await searchParams;
  const annual = view === "annual";

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("PARENT")) redirect("/dashboard");

  const { schoolId, parentId } = await requireParent();
  const children = await getParentChildren(schoolId, parentId);
  const child = resolveChild(children, childParam);

  if (!child) {
    return (
      <DashboardShell title="Child Report Cards" badge="Parent">
        <EmptyState
          icon={UsersRound}
          title="No children linked yet"
          description="Children linked to your account will appear here. Ask your school to link your account."
        />
      </DashboardShell>
    );
  }

  const options = await getReportOptions(schoolId);
  const session = resolveSession(options, sessionParam);
  const term = resolveTerm(session, termParam);

  if (!options.sessions.length || !session || (!annual && !term)) {
    return (
      <DashboardShell title="Child Report Cards" badge="Parent">
        <p className="text-sm text-muted-foreground">
          {!options.sessions.length
            ? "No academic sessions have been set up yet — report cards appear once a session is added."
            : "This session has no terms yet — add a term to generate report cards."}
        </p>
      </DashboardShell>
    );
  }

  const scope = annual
    ? { kind: "session" as const, session }
    : { kind: "term" as const, term: term! };
  const report = await getStudentReport(schoolId, child.studentId, scope);

  const termHref = `/parent/report-cards?child=${child.studentId}&session=${session.id}&view=term`;
  const annualHref = `/parent/report-cards?child=${child.studentId}&session=${session.id}&view=annual`;

  return (
    <DashboardShell title="Child Report Cards" badge="Parent">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ChildPicker options={children} childId={child.studentId} />
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
              termId={annual ? undefined : term?.id}
              view={annual ? "annual" : "term"}
            />
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Link href={annual ? termHref : annualHref} className="inline-flex">
              <Button variant="outline">
                {annual ? (
                  <>
                    <BarChart3 className="size-4" aria-hidden="true" />
                    Term view
                  </>
                ) : (
                  <>
                    <FileText className="size-4" aria-hidden="true" />
                    Annual view
                  </>
                )}
              </Button>
            </Link>
            {report && <PrintButton />}
          </div>
        </div>

        {report ? (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {child.displayName} · {child.className ?? "No class"}
              {child.streamName ? ` · ${child.streamName}` : ""}
            </p>
            <ReportCardPaper report={report} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your child&apos;s report card could not be generated — check that they are enrolled in a class.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}