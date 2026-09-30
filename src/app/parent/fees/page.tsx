import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  FileDown,
  Receipt,
  ScrollText,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireParent } from "@/services/parent";
import { confirmFeePayment, getParentFees } from "@/services/fees";
import { isFeeReference, isOverdue, paidFraction } from "@/lib/fee-math";
import {
  feeInvoiceStatusLabel,
  feePaymentStatusLabel,
  formatNaira,
} from "@/lib/fee-labels";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PayFeeButton } from "@/components/parent/pay-fee-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Fees & payments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Only the colour is local; the wording comes from the shared labels so the
// parent and the bursar never disagree about what a status is called.
const statusBadgeClass: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-800 border-emerald-500/40",
  partially_paid: "bg-amber-50 text-amber-800 border-amber-500/40",
  unpaid: "bg-rose-50 text-rose-800 border-rose-500/40",
  waived: "bg-sky-50 text-sky-800 border-sky-500/40",
  void: "bg-muted text-muted-foreground",
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad" | "ok";
}) {
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

type ParentPayment = { id: string; status: string };

/** An approved payment is the only kind that has money behind it, so it is the
 *  only kind that can back a receipt. */
function approvedPaymentIds(payments: ParentPayment[] = []) {
  return payments.filter((p) => p.status === "approved").map((p) => p.id);
}

function ReceiptLink({ paymentId }: { paymentId: string }) {
  return (
    <Link
      href={`/parent/fees/receipt/${paymentId}`}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
    >
      <FileDown className="size-3" aria-hidden="true" />
      Receipt
    </Link>
  );
}

export default async function ParentFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("PARENT")) redirect("/dashboard");
  await requireParent();

  // The parent returns here from Paystack. The webhook normally gets there
  // first, but confirming on return means the page is correct immediately even
  // when the webhook is slow or the school has not set one up yet.
  let notice: { ok: boolean; text: string } | null = null;
  if (reference && isFeeReference(reference)) {
    const result = await confirmFeePayment(reference);
    notice = { ok: result.ok, text: result.message };
  }

  const { summary, totals } = await getParentFees();
  const today = new Date().toISOString().slice(0, 10);

  const payable = summary.filter((r) => r.outstanding > 0);
  const settled = summary.filter((r) => r.outstanding <= 0);
  // Stable, de-duplicated child order so the statement link does not change
  // target between renders as invoices are grouped and sorted.
  const childIds = [
    ...new Set(
      summary
        .map((r) => r.invoice.students?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  return (
    <DashboardShell title="Fees & Payments" badge="Parent">
      <div className="grid gap-4">
        {notice && (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              notice.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {notice.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <p>{notice.text}</p>
          </div>
        )}

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
            description="When the school issues a fee invoice for any of your children it will appear here, and you will be able to pay it online."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Balances and receipts are per child.
              </p>
              {/* The statement is per child, so the link has to name one. The
                  picker on that page switches between the rest. */}
              {childIds[0] && (
                <Link
                  href={`/parent/fees/statement?child=${childIds[0]}`}
                  className="inline-flex"
                >
                  <Button variant="outline">
                    <ScrollText className="size-4" aria-hidden="true" />
                    Statement of account
                  </Button>
                </Link>
              )}
            </div>

            {payable.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="size-4" aria-hidden="true" />
                    Awaiting payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {payable.map(({ invoice, outstanding, payments }) => {
                    const overdue = isOverdue({
                      status: invoice.status,
                      dueDate: invoice.due_date,
                      today,
                    });
                    const fraction = paidFraction(
                      Number(invoice.amount),
                      Number(invoice.amount_paid),
                    );
                    const awaiting = payments.find((p) => p.status === "submitted");

                    return (
                      <div
                        key={invoice.id}
                        className="grid gap-2 rounded-lg border p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {invoice.students?.display_name ?? "Your child"}
                          </span>
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
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {invoice.description}
                          {invoice.due_date && (
                            <> · due {new Date(invoice.due_date).toLocaleDateString()}</>
                          )}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>
                            {formatNaira(Number(invoice.amount_paid), invoice.currency)}{" "}
                            <span className="text-muted-foreground">
                              of {formatNaira(Number(invoice.amount), invoice.currency)}
                            </span>
                          </span>
                          <span className="font-semibold text-destructive">
                            {formatNaira(outstanding, invoice.currency)} due
                          </span>
                        </div>

                        {fraction > 0 && fraction < 1 && (
                          <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.round(fraction * 100)}%` }}
                            />
                          </div>
                        )}

                        {awaiting ? (
                          <p className="text-xs text-muted-foreground">
                            Payment received and waiting for the school to confirm.
                          </p>
                        ) : (
                          <PayFeeButton
                            invoiceId={invoice.id}
                            amount={outstanding}
                          />
                        )}

                        {payments.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground">
                              Payment history ({payments.length})
                            </summary>
                            <ul className="mt-1.5 grid gap-1">
                              {payments.map((p) => (
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
                                    {/* Only an approval credits an invoice, so only
                                        an approved payment has money behind it and a
                                        receipt worth printing. */}
                                    {p.status === "approved" && (
                                      <ReceiptLink paymentId={p.id} />
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {payments.some((p) => p.review_note) && (
                              <p className="mt-1.5 text-muted-foreground">
                                {payments.find((p) => p.review_note)?.review_note}
                              </p>
                            )}
                          </details>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {settled.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Settled &amp; closed</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {settled.map((row) => (
                    <div
                      key={row.invoice.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <div className="grid gap-0.5">
                        <span className="font-medium">
                          {row.invoice.students?.display_name ?? "Your child"}
                        </span>
                        <span className="text-muted-foreground">
                          {row.invoice.description}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {formatNaira(
                            Number(row.invoice.amount),
                            row.invoice.currency,
                          )}
                        </span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-xs ${
                            statusBadgeClass[row.invoice.status] ?? ""
                          }`}
                        >
                          {feeInvoiceStatusLabel(row.invoice.status)}
                        </span>
                        {/* A settled invoice is the one a parent is most likely
                            to want proof of, so its receipts cannot live behind
                            the payment history of an invoice that is still
                            open. */}
                        {approvedPaymentIds(row.payments).map((id) => (
                          <ReceiptLink key={id} paymentId={id} />
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
