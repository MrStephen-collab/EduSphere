import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  FileDown,
  Receipt,
  ScrollText,
  Wallet,
} from "lucide-react";
import { getStudentFees } from "@/services/fees";
import { getStudentLearningAccess } from "@/services/fee-access";
import { requireStudent } from "@/services/learning";
import { isOverdue, paidFraction } from "@/lib/fee-math";
import {
  feeInvoiceStatusLabel,
  feePaymentStatusLabel,
  formatNaira,
} from "@/lib/fee-labels";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FeeGateNotice } from "@/components/learning/fee-gate-notice";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My fees",
  robots: { index: false, follow: false },
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bad" | "ok" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold ${tone === "bad" ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export default async function StudentFeesPage() {
  const { summary, totals } = await getStudentFees();
  const { schoolId, studentId } = await requireStudent();
  const access = await getStudentLearningAccess(schoolId, studentId);

  const outstandingRows = summary.filter((r) => r.outstanding > 0);
  const settledRows = summary.filter((r) => r.outstanding <= 0);
  const today = new Date();

  return (
    <DashboardShell title="My Fees" badge="Student">
      <div className="grid gap-4">
        <header>
          <h1 className="text-xl font-semibold">My fees</h1>
          <p className="text-sm text-muted-foreground">
            What your school has billed you, what has been paid, and what is
            still owed. Payments are made by your parent or guardian.
          </p>
        </header>

        <FeeGateNotice access={access} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Total billed" value={formatNaira(totals.invoiced)} />
          <Stat label="Paid" value={formatNaira(totals.paid)} />
          <Stat
            label="Outstanding"
            value={formatNaira(totals.outstanding)}
            tone={totals.outstanding > 0 ? "bad" : "ok"}
          />
        </div>

        {summary.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No fee invoices yet"
            description="When your school raises a fee invoice it will appear here, along with any receipt for a payment already made."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Wallet className="size-4" aria-hidden="true" />
                Need to pay? Share this page with your parent or guardian, or ask
                the bursar for the payment reference.
              </p>
              <Link href="/student/fees/statement" className="inline-flex">
                <Button variant="outline">
                  <ScrollText className="size-4" aria-hidden="true" />
                  Statement of account
                </Button>
              </Link>
            </div>

            {outstandingRows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Awaiting payment</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {outstandingRows.map((row) => {
                    const invoice = row.invoice;
                    const overdue =
                      invoice.due_date !== null &&
                      isOverdue({
                        dueDate: invoice.due_date,
                        status: invoice.status,
                        today: today.toISOString().slice(0, 10),
                      });
                    const fraction = paidFraction(
                      Number(invoice.amount),
                      Number(invoice.amount_paid),
                    );
                    const awaiting = row.payments.find((p) => p.status === "submitted");

                    return (
                      <div key={invoice.id} className="grid gap-2 rounded-lg border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{invoice.description}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {feeInvoiceStatusLabel(invoice.status)}
                          </Badge>
                          {overdue && (
                            <span className="rounded-md border border-rose-500/40 bg-rose-50 px-2 py-0.5 text-xs text-rose-800">
                              Overdue
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {formatNaira(Number(invoice.amount_paid), invoice.currency)} of{" "}
                          {formatNaira(Number(invoice.amount), invoice.currency)} paid
                          {invoice.due_date && (
                            <> · due {new Date(invoice.due_date).toLocaleDateString()}</>
                          )}
                        </p>

                        <div
                          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                          role="img"
                          aria-label={`${Math.round(fraction * 100)}% paid`}
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, fraction * 100)}%` }}
                          />
                        </div>

                        {awaiting && (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                            A payment of{" "}
                            {formatNaira(Number(awaiting.amount), invoice.currency)} is
                            waiting for the bursar to approve.
                          </p>
                        )}

                        {row.payments.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer font-medium">
                              Payment history ({row.payments.length})
                            </summary>
                            <ul className="mt-1.5 grid gap-1">
                              {row.payments.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex flex-wrap items-center justify-between gap-2"
                                >
                                  <span>
                                    {formatNaira(Number(p.amount), invoice.currency)} ·{" "}
                                    {new Date(p.created_at).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {feePaymentStatusLabel(p.status)}
                                    </Badge>
                                    {p.status === "approved" && (
                                      <Link
                                        href={`/student/fees/receipt/${p.id}`}
                                        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                                      >
                                        <FileDown className="size-3" aria-hidden="true" />
                                        Receipt
                                      </Link>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {settledRows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Settled &amp; closed</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {settledRows.map((row) => (
                    <div
                      key={row.invoice.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <span className="font-medium">{row.invoice.description}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {formatNaira(Number(row.invoice.amount), row.invoice.currency)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {feeInvoiceStatusLabel(row.invoice.status)}
                        </Badge>
                        {row.payments
                          .filter((p) => p.status === "approved")
                          .map((p) => (
                            <Link
                              key={p.id}
                              href={`/student/fees/receipt/${p.id}`}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                            >
                              <FileDown className="size-3" aria-hidden="true" />
                              Receipt
                            </Link>
                          ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
