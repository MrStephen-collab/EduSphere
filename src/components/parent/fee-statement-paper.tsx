import type { ParentStatement } from "@/services/fees";
import { formatNaira, feeInvoiceStatusLabel } from "@/lib/fee-labels";

function longDate(value: string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Figure({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "bad" | "ok";
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold ${
          tone === "bad" ? "text-destructive" : tone === "ok" ? "text-emerald-700" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * A statement of account for one child: every charge, every credit, and the
 * balance owed after each line.
 *
 * The running balance is the whole point of the document. A parent arguing about
 * what they owe needs to see the sequence, not just a total, and a bursar
 * reconciling a term needs the same order the money moved in.
 */
export function FeeStatementPaper({ statement }: { statement: ParentStatement }) {
  const { child, rows, currency } = statement;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
      <div className="grid gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4 print:border-foreground/20">
          <div>
            <p className="text-lg font-semibold leading-tight">Statement of Account</p>
            <p className="text-xs text-muted-foreground">
              {child.displayName} · Admission no. {child.admissionNumber}
              {child.className ? ` · ${child.className}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Generated</p>
            <p className="text-sm font-medium">{longDate(statement.generatedAt)}</p>
          </div>
        </header>

        <section className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
          <Figure label="Total charged" value={formatNaira(statement.totalCharged, currency)} />
          <Figure label="Total credited" value={formatNaira(statement.totalCredited, currency)} />
          <Figure
            label="Balance owed"
            value={formatNaira(statement.closingBalance, currency)}
            tone={statement.closingBalance > 0 ? "bad" : "ok"}
          />
        </section>

        {statement.hasUnbackedCredits && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Some payments on this statement were approved before the school
            recorded the amount credited. Those rows show what was paid; please
            confirm them with the school&apos;s bursary.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No fee charges or payments have been recorded for this child yet.
          </p>
        ) : (
          <section className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Reference</th>
                  <th className="py-2 pr-3 text-right font-medium">Charge</th>
                  <th className="py-2 pr-3 text-right font-medium">Payment</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {longDate(row.date)}
                    </td>
                    <td className="py-2 pr-3">{row.description}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                      {row.reference ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {row.kind === "charge" ? formatNaira(row.movement, currency) : ""}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap text-emerald-700">
                      {row.kind === "credit" ? formatNaira(-row.movement, currency) : ""}
                    </td>
                    <td className="py-2 text-right font-semibold whitespace-nowrap">
                      {formatNaira(row.balance, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="py-2 pr-3 font-semibold" colSpan={5}>
                    Balance owed
                  </td>
                  <td className="py-2 text-right text-base font-bold">
                    {formatNaira(statement.closingBalance, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {statement.excluded.length > 0 && (
          <section className="rounded-md border border-dashed p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Not included in the balance
            </p>
            <ul className="mt-2 grid gap-1 text-sm">
              {statement.excluded.map((item, i) => (
                <li key={`${item.description}-${i}`} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {item.description}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({feeInvoiceStatusLabel(item.status)})
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatNaira(item.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              These were raised but are not owed — cancelled, or written off by
              the school.
            </p>
          </section>
        )}

        <footer className="grid gap-8 border-t pt-6 text-xs sm:grid-cols-2">
          <div className="text-center">
            <div className="h-8 border-b border-foreground/30" />
            <p className="mt-1 text-muted-foreground">Bursar</p>
          </div>
          <div className="text-center">
            <div className="h-8 border-b border-foreground/30" />
            <p className="mt-1 text-muted-foreground">Parent / guardian</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
