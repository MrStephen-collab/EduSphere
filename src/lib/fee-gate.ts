import { computeInvoiceTotals, roundMoney } from "@/lib/fee-math";
import type { FeeInvoiceStatus } from "@/types/database";

/**
 * Whether a student has paid enough of their fees to open course materials.
 *
 * The arithmetic lives here, apart from any database, because the interesting
 * cases are all edge cases and edge cases are exactly what is hard to arrange in
 * a fixture: a student who has never been billed, a school that has never set a
 * threshold, a bursary that waived the whole bill. Each of those is one line of
 * logic and one unit test rather than a row in a test database.
 *
 * The totals come from `computeInvoiceTotals`, so this gate and the parent's fees
 * page agree by construction about what counts as billed. Waived and void
 * invoices are outside the billed figure, which is what makes a scholarship or a
 * bursary case need no separate exemption list: waiving the invoice *is* the
 * exemption.
 */

export type FeeStanding = {
  invoiced: number;
  paid: number;
  outstanding: number;
};

export type LearningAccessDecision = FeeStanding & {
  /** The school's setting. Zero means the gate is switched off. */
  thresholdPct: number;
  /** What share of the bill has actually been paid, 0-100. */
  paidPct: number;
  /** The amount still needed to clear the gate. Zero once it is cleared. */
  required: number;
  /** True when the school has switched this on. */
  gateActive: boolean;
  /** The single word the rest of the app branches on. */
  allowed: boolean;
};

/** Clamped to a whole percentage, because a school will type 45.5 by accident. */
export function normaliseThreshold(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * The gate itself.
 *
 * Two cases are deliberately permissive, and both matter more than they look:
 *
 *   - **The gate is off** (threshold zero) allows everything. Default off is what
 *     keeps this from changing any school's behaviour on upgrade; an admin turns
 *     it on deliberately.
 *   - **Nothing has ever been billed** allows everything. A school that has not
 *     raised an invoice yet is not withholding teaching from a pupil over a
 *     balance of zero -- that would read as punishment for the school's inaction,
 *     and the "0% of 0" that strict arithmetic gives is a division by nothing.
 */
export function evaluateLearningAccess(
  thresholdPct: number,
  standing: FeeStanding,
): LearningAccessDecision {
  const threshold = normaliseThreshold(thresholdPct);
  const invoiced = roundMoney(Math.max(0, standing.invoiced));
  const paid = roundMoney(Math.max(0, standing.paid));
  const outstanding = roundMoney(Math.max(0, standing.outstanding));
  const gateActive = threshold > 0 && invoiced > 0;

  const paidPct = invoiced > 0 ? Math.min(100, Math.round((paid / invoiced) * 100)) : 100;
  const target = roundMoney((invoiced * threshold) / 100);
  const required = gateActive ? Math.max(0, roundMoney(target - paid)) : 0;

  return {
    invoiced,
    paid,
    outstanding,
    thresholdPct: threshold,
    paidPct,
    required,
    gateActive,
    allowed: !gateActive || paid >= target,
  };
}

/** The student-facing sentence, in one place so the pages cannot disagree. */
export function describeAccessBlock(decision: LearningAccessDecision): string {
  if (decision.allowed || !decision.gateActive) return "";
  const percent = decision.thresholdPct;
  return `Course materials open once ${percent}% of your fees are paid. You have paid ${decision.paidPct}%, so ${decision.required.toLocaleString("en-NG")} more is due.`;
}

type TotalsInput = {
  amount: number | string;
  amount_paid: number | string;
  status: FeeInvoiceStatus;
};

/**
 * A student's standing, from their invoices.
 *
 * Reuses `computeInvoiceTotals` rather than totalling again, so "what this gate
 * thinks you owe" and "what the fees page says you owe" cannot drift apart.
 */
export function standingFromInvoices(invoices: TotalsInput[]): FeeStanding {
  const totals = computeInvoiceTotals(
    invoices.map((i) => ({
      amount: Number(i.amount),
      amount_paid: Number(i.amount_paid),
      status: i.status,
    })),
  );
  return { invoiced: totals.invoiced, paid: totals.paid, outstanding: totals.outstanding };
}