import type { Metadata } from "next";
import { CheckCircle2, Inbox, Receipt, Wallet } from "lucide-react";
import { requireSchoolAdmin } from "@/services/shared";
import { getClasses, getSchoolTerms } from "@/services/academics";
import { getStudents } from "@/services/people";
import { getSchoolFees } from "@/services/fees";
import { isOverdue } from "@/lib/fee-math";
import { feeInvoiceStatusLabel, formatNaira } from "@/lib/fee-labels";
import { asArray } from "@/lib/embed";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FeeReviewRow } from "@/components/school/fee-review-row";
import { FeeIssueForm } from "@/components/school/fee-issue-form";
import { FeeGenerateForm } from "@/components/school/fee-generate-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Fees",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const statusBadgeClass: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-800 border-emerald-500/40",
  partially_paid: "bg-amber-50 text-amber-800 border-amber-500/40",
  unpaid: "bg-rose-50 text-rose-800 border-rose-500/40",
  waived: "bg-sky-50 text-sky-800 border-sky-500/40",
  void: "bg-muted text-muted-foreground",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function SchoolFeesPage() {
  const { schoolId } = await requireSchoolAdmin();

  const [{ stats, reviewQueue, invoices }, classes, terms, students] =
    await Promise.all([
      getSchoolFees(),
      getClasses(schoolId),
      getSchoolTerms(schoolId),
      getStudents(schoolId),
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
    <DashboardShell title="Fees" badge="Administrator">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Invoiced" value={formatNaira(stats.invoiced)} />
          <Stat
            label="Collected"
            value={formatNaira(stats.collected)}
            hint={`${collectedPct}% of what was billed`}
          />
          <Stat
            label="Outstanding"
            value={formatNaira(stats.outstanding)}
            hint={`${stats.overdueCount} overdue`}
          />
          <Stat
            label="Awaiting approval"
            value={String(stats.awaitingApproval)}
            hint={
              stats.awaitingApproval > 0
                ? "Payments received but not yet confirmed"
                : "Nothing to review"
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Payments to review
            </CardTitle>
            <CardDescription>
              A payment only settles an invoice once you approve it here. Money
              arriving is not the same as money accepted.
            </CardDescription>
          </CardHeader>
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

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="size-4" aria-hidden="true" />
                Bill a class or term
              </CardTitle>
              <CardDescription>
                Issues the same charge to every student you pick. Running it
                again will not double-bill.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeeGenerateForm classes={classOptions} terms={termOptions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4" aria-hidden="true" />
                Bill a single child
              </CardTitle>
              <CardDescription>
                For one-off charges like a resit, an excursion or a replacement
                uniform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeeIssueForm students={studentOptions} terms={termOptions} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
            <CardDescription>
              The most recent {invoices.length} invoice{invoices.length === 1 ? "" : "s"}.
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
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
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
                          <span className="font-medium">
                            {invoice.students?.display_name ?? "Unknown"}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {invoice.students?.admission_number}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{invoice.description}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatNaira(Number(invoice.amount), invoice.currency)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                          {formatNaira(Number(invoice.amount_paid), invoice.currency)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {payable && outstanding > 0
                            ? formatNaira(outstanding, invoice.currency)
                            : "—"}
                        </td>
                        <td className="py-2">
                          <span className="flex flex-wrap gap-1">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-xs ${
                                statusBadgeClass[invoice.status] ?? ""
                              }`}
                            >
                              {feeInvoiceStatusLabel(invoice.status)}
                            </span>
                            {overdue && (
                              <span className="rounded-md border border-rose-500/40 bg-rose-50 px-2 py-0.5 text-xs text-rose-800">
                                Overdue
                              </span>
                            )}
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
      </div>
    </DashboardShell>
  );
}
