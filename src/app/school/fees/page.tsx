import type { Metadata } from "next";
import { AlertCircle, Inbox, Receipt, Wallet } from "lucide-react";
import { requireFeeOfficer } from "@/services/shared";
import { getClasses, getSchoolTerms } from "@/services/academics";
import { getStudents } from "@/services/people";
import { getSchoolFees } from "@/services/fees";
import { getSchoolLearningThreshold } from "@/services/fee-access";
import { isOverdue } from "@/lib/fee-math";
import { feeInvoiceStatusLabel, formatNaira } from "@/lib/fee-labels";
import { asArray } from "@/lib/embed";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { FeeReviewRow } from "@/components/school/fee-review-row";
import { FeeIssueForm } from "@/components/school/fee-issue-form";
import { FeeGenerateForm } from "@/components/school/fee-generate-form";
import { LearningAccessGateForm } from "@/components/school/learning-access-gate-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export const metadata: Metadata = {
  title: "Fees",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const invoiceBadgeVariant: Record<
  string,
  "success" | "amber" | "destructive" | "cyan" | "secondary"
> = {
  paid: "success",
  partially_paid: "amber",
  unpaid: "destructive",
  waived: "cyan",
  void: "secondary",
};

function initials(name: string | null | undefined): string {
  return (name ?? "Student")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function SchoolFeesPage() {
  const officer = await requireFeeOfficer();
  const { schoolId } = officer;

  const [{ stats, reviewQueue, invoices }, classes, terms, students, learningThreshold] =
    await Promise.all([
      getSchoolFees(),
      getClasses(schoolId),
      getSchoolTerms(schoolId),
      getStudents(schoolId),
      getSchoolLearningThreshold(schoolId),
    ]);

  const today = new Date().toISOString().slice(0, 10);
  const collectedPct =
    stats.invoiced > 0 ? Math.round((stats.collected / stats.invoiced) * 100) : 0;

  const studentOptions = students.map((s) => ({
    id: s.id,
    label: `${s.display_name ?? asArray(s.profile)[0]?.full_name ?? "Unnamed"} · ${s.admission_number}`,
  }));
  const classOptions = classes.map((c) => ({ id: c.id, label: c.name }));
  const termOptions = terms.map((t) => ({ id: t.id, label: t.name }));

  return (
    <DashboardShell
      title="Fees"
      badge={officer.role === "BURSAR" ? "Bursar" : "Administrator"}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            title="Invoiced"
            value={formatNaira(stats.invoiced)}
            icon={Receipt}
            tone="indigo"
            hint="Billed to students"
          />
          <StatCard
            title="Collected"
            value={formatNaira(stats.collected)}
            icon={Wallet}
            tone="emerald"
            index={1}
            hint={`${collectedPct}% of what was billed`}
          />
          <StatCard
            title="Outstanding"
            value={formatNaira(stats.outstanding)}
            icon={AlertCircle}
            tone="amber"
            index={2}
            hint={`${stats.overdueCount} overdue`}
          />
          <StatCard
            title="Awaiting approval"
            value={stats.awaitingApproval}
            icon={Inbox}
            tone="fuchsia"
            index={3}
            hint={
              stats.awaitingApproval > 0
                ? "Payments received but not confirmed"
                : "Nothing to review"
            }
          />
        </div>

        <Card tone="emerald">
          <CardContent className="grid gap-2 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">Collection progress</span>
              <span className="text-muted-foreground">
                {formatNaira(stats.collected)} of {formatNaira(stats.invoiced)}
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-background"
              role="progressbar"
              aria-valuenow={collectedPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Fees collected"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                style={{ width: `${Math.min(100, collectedPct)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <CollapsibleSection
          className="mt-1"
          compact
          title="Payments to review"
          description="A payment only settles an invoice once you approve it here. Money arriving is not the same as money accepted."
          defaultOpen
        >
          <Card tone="amber">
            <CardContent className="grid gap-3">
              {reviewQueue.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nothing waiting"
                  description="When a parent's payment is confirmed by Paystack it will appear here for you to approve or reject."
                />
              ) : (
                reviewQueue.map((row) => (
                  <FeeReviewRow
                    key={row.payment.id}
                    paymentId={row.payment.id}
                    studentName={row.studentName}
                    description={row.description}
                    attempted={Number(row.payment.amount)}
                    currency={row.currency}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          className="mt-1"
          compact
          title="Bill a class or term"
          description="Issues the same charge to every student you pick. Running it again will not double-bill."
        >
          <Card tone="indigo">
            <CardContent>
              <FeeGenerateForm classes={classOptions} terms={termOptions} />
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          className="mt-1"
          compact
          title="Bill a single child"
          description="For one-off charges like a resit, an excursion or a replacement uniform."
        >
          <Card tone="sky">
            <CardContent>
              <FeeIssueForm students={studentOptions} terms={termOptions} />
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          className="mt-1"
          compact
          title="Fee gate"
          description="Hold course materials from students whose fees are behind."
        >
          <Card tone="violet">
            <CardContent>
              <LearningAccessGateForm
                schoolId={schoolId}
                thresholdPct={learningThreshold}
              />
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          className="mt-1"
          compact
          title="Invoices"
          description={`The most recent ${invoices.length} invoice${invoices.length === 1 ? "" : "s"}.`}
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">Recent invoices</CardTitle>
                <Badge variant="brand">{invoices.length} shown</Badge>
              </div>
              <CardDescription className="text-xs">
                A row in red is past its due date.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {invoices.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No invoices yet"
                  description="Bill a class above to issue this school's first fee invoices."
                />
              ) : (
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Student</th>
                      <th className="py-2 pr-3 font-medium">Description</th>
                      <th className="py-2 pr-3 text-right font-medium">Amount</th>
                      <th className="py-2 pr-3 text-right font-medium">Paid</th>
                      <th className="py-2 pr-3 text-right font-medium">Outstanding</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const outstanding = Math.max(
                        0,
                        Number(invoice.amount) - Number(invoice.amount_paid),
                      );
                      const payable =
                        invoice.status === "unpaid" ||
                        invoice.status === "partially_paid";
                      const overdue = isOverdue({
                        status: invoice.status,
                        dueDate: invoice.due_date,
                        today,
                      });

                      return (
                        <tr key={invoice.id} className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                {initials(invoice.students?.display_name)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium">
                                  {invoice.students?.display_name ?? "Unknown"}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {invoice.students?.admission_number}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-3">{invoice.description}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatNaira(Number(invoice.amount), invoice.currency)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                            {formatNaira(Number(invoice.amount_paid), invoice.currency)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-medium">
                            {payable && outstanding > 0
                              ? formatNaira(outstanding, invoice.currency)
                              : "—"}
                          </td>
                          <td className="py-2">
                            <span className="flex flex-wrap gap-1">
                              <Badge
                                variant={invoiceBadgeVariant[invoice.status] ?? "secondary"}
                              >
                                {feeInvoiceStatusLabel(invoice.status)}
                              </Badge>
                              {overdue && <Badge variant="destructive">Overdue</Badge>}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </CollapsibleSection>
      </div>
    </DashboardShell>
  );
}
