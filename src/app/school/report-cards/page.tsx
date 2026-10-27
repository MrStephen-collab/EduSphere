import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireSchoolAdmin } from "@/services/shared";
import {
  getTraditionalEntryContext,
  listTraditionalReportCards,
} from "@/services/traditional-report-cards";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { TraditionalReportCardFilters } from "@/components/report/traditional/traditional-report-card-filters";

export const metadata: Metadata = {
  title: "Report Cards",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatStamp(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

export default async function SchoolReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string }>;
}) {
  const { class: classParam, term: termParam } = await searchParams;

  const admin = await requireSchoolAdmin();
  if (!admin.context.user) redirect("/auth/login");

  const context = await getTraditionalEntryContext(admin.schoolId, null);

  if (context.classes.length === 0 || context.terms.length === 0) {
    return (
      <DashboardShell title="Report Cards">
        <p className="text-sm text-muted-foreground">
          Add at least one class and one term before managing report cards.
        </p>
      </DashboardShell>
    );
  }

  const classId =
    context.classes.find((c) => c.id === classParam)?.id ??
    context.defaultClassId ??
    context.classes[0].id;
  const termId =
    context.terms.find((t) => t.id === termParam)?.id ??
    context.defaultTermId ??
    context.terms[0].id;

  const rows = await listTraditionalReportCards(admin.schoolId, classId, termId, null);
  const savedCount = rows.filter((r) => r.cardId).length;

  return (
    <DashboardShell title="Report Cards">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Report Card Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage traditional report cards for nursery, primary and secondary
              schools.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/teacher/report-cards/traditional" />}>
              <FileText className="size-4" aria-hidden="true" />
              Preview template
            </Button>
            <Button
              render={
                <Link
                  href={`/teacher/report-cards/entry?class=${classId}&term=${termId}`}
                />
              }
            >
              Enter results
            </Button>
          </div>
        </div>

        <TraditionalReportCardFilters
          classes={context.classes}
          terms={context.terms}
          students={[]}
          classId={classId}
          termId={termId}
          studentId=""
          showStudent={false}
        />

        <p className="text-xs text-muted-foreground">
          {savedCount} of {rows.length} student
          {rows.length === 1 ? "" : "s"} have a saved report card for this term.
          Select a student below to enter or edit their card.
        </p>

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No students are enrolled in this class yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Admission no.</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Last saved</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.studentId} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.displayName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.admissionNumber}
                    </td>
                    <td className="px-3 py-2">
                      {row.cardId ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Saved
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Not started
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.updatedAt ? formatStamp(row.updatedAt) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <Link
                            href={`/teacher/report-cards/entry?class=${classId}&term=${termId}&student=${row.studentId}`}
                          />
                        }
                      >
                        {row.cardId ? "Open" : "Enter results"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
