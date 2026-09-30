import type { ReactNode } from "react";
import type { FeeReceipt } from "@/services/fees";
import { formatNaira, feeInvoiceStatusLabel } from "@/lib/fee-labels";

function longDate(value: string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

/**
 * A receipt for one approved payment, laid out to survive being printed on a
 * half-depleted school printer and handed over as proof of payment.
 *
 * The credited figure is the headline, not the tendered one. When a parent pays
 * more than they owe the school keeps the balance and the difference is not a
 * credit against anything, so leading with the tendered amount would overstate
 * what the receipt is worth and start an argument at the bursar's window.
 */
export function FeeReceiptPaper({ receipt }: { receipt: FeeReceipt }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border bg-card p-6 shadow-sm sm:p-8">
      <div className="grid gap-5">
        <header className="flex items-start justify-between gap-4 border-b pb-4 print:border-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {receipt.school.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">{receipt.school.name}</p>
              {receipt.school.motto && (
                <p className="text-xs italic text-muted-foreground">{receipt.school.motto}</p>
              )}
              {receipt.school.address && (
                <p className="text-xs text-muted-foreground">{receipt.school.address}</p>
              )}
              {(receipt.school.phone || receipt.school.email) && (
                <p className="text-xs text-muted-foreground">
                  {[receipt.school.phone, receipt.school.email].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide">Payment receipt</p>
            <p className="font-mono text-xs text-muted-foreground">{receipt.reference}</p>
            <p className="mt-1 text-xs text-muted-foreground">{longDate(receipt.paidAt)}</p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Received from</p>
            <p className="font-medium">{receipt.childName}</p>
            <p className="text-xs text-muted-foreground">
              Admission no. {receipt.admissionNumber}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">For</p>
            <p className="font-medium">{receipt.description}</p>
            <p className="text-xs text-muted-foreground">{receipt.method}</p>
          </div>
        </section>

        <section className="rounded-md border p-4">
          <Row label="Amount received" value={formatNaira(receipt.credited, receipt.currency)} />
          {receipt.overpaid && (
            <>
              <Row
                label="Tendered"
                value={formatNaira(receipt.tendered, receipt.currency)}
              />
              <Row
                label="Returned / not credited"
                value={`− ${formatNaira(
                  receipt.tendered - receipt.credited,
                  receipt.currency,
                )}`}
              />
            </>
          )}
          <Row label="Method" value={receipt.method} />
          {receipt.providerReference && (
            <Row
              label="Payment reference"
              value={<span className="font-mono text-xs">{receipt.providerReference}</span>}
            />
          )}
        </section>

        <section className="rounded-md border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Invoice this settles
          </p>
          <div className="mt-1 grid gap-1 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Invoice total</p>
              <p className="font-semibold">
                {formatNaira(receipt.invoiceTotal, receipt.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid to date</p>
              <p className="font-semibold">
                {formatNaira(receipt.invoicePaidAfter, receipt.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold">
                {feeInvoiceStatusLabel(receipt.invoiceStatus)}
              </p>
            </div>
          </div>
        </section>

        {receipt.note && (
          <p className="rounded-md border border-dashed p-3 text-sm">{receipt.note}</p>
        )}

        <footer className="grid gap-8 border-t pt-6 text-xs sm:grid-cols-2">
          <div className="text-center">
            <div className="h-8 border-b border-foreground/30" />
            <p className="mt-1 text-muted-foreground">Received by (bursar)</p>
          </div>
          <div className="text-center">
            <div className="h-8 border-b border-foreground/30" />
            <p className="mt-1 text-muted-foreground">Parent / guardian</p>
          </div>
        </footer>

        <p className="text-xs text-muted-foreground">
          This receipt is issued for the payment above only and is not a
          statement of account. Any balance still owed appears on the statement
          of account for this child.
        </p>
      </div>
    </div>
  );
}
