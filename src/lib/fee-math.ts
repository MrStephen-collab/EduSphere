// Pure money arithmetic for fee invoices and payments.
//
// This module deliberately imports nothing: the approval path moves real money,
// so the arithmetic that decides what an invoice is worth and how much of a
// payment actually credits it is kept in plain functions that can be tested
// without a database, a session, or a payment provider. The service layer does
// the I/O and calls into here for every number it persists.

import type { FeeInvoiceStatus } from "@/types/database";

/** Paystack amounts are integers in the currency's minor unit (kobo). */
export const FEE_CURRENCY = "NGN";

export const FEE_REFERENCE_PREFIX = "fee_";
export const SUBSCRIPTION_REFERENCE_PREFIX = "ed_";

/** Marks a payment attempt so the webhook can tell fees from subscriptions. */
export function buildFeeReference(): string {
  return `${FEE_REFERENCE_PREFIX}${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * The webhook and the post-checkout redirect both receive a bare reference and
 * must decide which ledger it belongs to. Subscription checkout already uses
 * `ed_`, so a `fee_` prefix is unambiguous and needs no extra column.
 */
export function isFeeReference(reference: string): boolean {
  return reference.startsWith(FEE_REFERENCE_PREFIX);
}

export function isSubscriptionReference(reference: string): boolean {
  return reference.startsWith(SUBSCRIPTION_REFERENCE_PREFIX);
}

/**
 * Money is stored as numeric(12,2) but arrives from Paystack and from form
 * inputs as a JS number, so every value is snapped to 2dp before it is compared
 * or stored. Without this, 0.1 + 0.2 style drift can make a fully paid invoice
 * look 0.0000001 short and block the final payment.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Major units to the integer minor units Paystack expects. */
export function toMinorUnits(major: number): number {
  return Math.round(roundMoney(major) * 100);
}

export function fromMinorUnits(minor: number): number {
  return roundMoney(minor / 100);
}

/**
 * A deterministic key so "charge First Term to JSS 1" can be run twice without
 * billing the class twice: the unique index on (school_id, billing_key) turns
 * the second run into a no-op instead of a second invoice per student.
 */
export function buildBillingKey(input: {
  termId: string;
  classId: string | null;
}): string {
  return `term:${input.termId}:class:${input.classId ?? "all"}`;
}

/** An invoice can only be paid while it is genuinely outstanding. */
export function isPayableStatus(status: FeeInvoiceStatus): boolean {
  return status === "unpaid" || status === "partially_paid";
}

/** What a parent still owes. Void and waived invoices owe nothing. */
export function outstandingFor(invoice: {
  amount: number;
  amount_paid: number;
  status: FeeInvoiceStatus;
}): number {
  if (!isPayableStatus(invoice.status)) return 0;
  return roundMoney(Math.max(0, invoice.amount - invoice.amount_paid));
}

/**
 * The invoice status implied by an amount paid against it. A waived invoice
 * keeps its own status, which is why this is only called while payable.
 */
export function statusForAmounts(
  amount: number,
  amountPaid: number,
): Extract<
  FeeInvoiceStatus,
  "unpaid" | "partially_paid" | "paid"
> {
  const paid = roundMoney(amountPaid);
  const total = roundMoney(amount);
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partially_paid";
}

export type ApprovalResult = {
  /** The amount to persist onto the invoice, after clamping. */
  amountPaid: number;
  /** How much of the payment was actually credited. */
  credited: number;
  status: Extract<FeeInvoiceStatus, "unpaid" | "partially_paid" | "paid">;
  /**
   * Payment minus credited. Non-zero when a bursar approves more than was owed
   * (a part payment, a corrected amount, a duplicate). The payment is still
   * approved; the surplus is surfaced so it can be refunded or written off
   * deliberately rather than silently vanishing into the invoice.
   */
  uncredited: number;
};

/**
 * Fold an approved payment into an invoice.
 *
 * Clamping to the outstanding balance matters because the database refuses
 * `amount_paid > amount`; without this an approval could fail at the last step
 * and leave a payment stuck in the queue. The caller must still re-read the
 * invoice immediately before calling this, because two bursars approving at
 * once would otherwise both credit the same outstanding balance.
 */
export function applyApproval(
  invoice: { amount: number; amount_paid: number },
  paymentAmount: number,
): ApprovalResult {
  const total = roundMoney(invoice.amount);
  const alreadyPaid = roundMoney(invoice.amount_paid);
  const outstanding = roundMoney(Math.max(0, total - alreadyPaid));
  const offered = roundMoney(Math.max(0, paymentAmount));
  const credited = roundMoney(Math.min(offered, outstanding));
  const amountPaid = roundMoney(Math.min(total, alreadyPaid + credited));

  return {
    amountPaid,
    credited,
    status: statusForAmounts(total, amountPaid),
    uncredited: roundMoney(offered - credited),
  };
}

/** An invoice is overdue when it is still owed and its due date has passed. */
export function isOverdue(input: {
  status: FeeInvoiceStatus;
  dueDate: string | null;
  today: string;
}): boolean {
  if (!isPayableStatus(input.status)) return false;
  if (!input.dueDate) return false;
  return input.dueDate < input.today;
}

/** Renders a "3 of 5" style completion ratio for progress meters. */
export function paidFraction(amount: number, amountPaid: number): number {
  const total = roundMoney(amount);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, roundMoney(amountPaid) / total));
}

// ---------------------------------------------------------------------------
// Receipts and statements
// ---------------------------------------------------------------------------

/**
 * A receipt has to carry a reference a parent can quote to a bursar, and it has
 * to be legible over the phone. The provider reference is useless for this -- it
 * is a 32-character uuid prefix like `fee_9f2c...`. The payment's own id is a
 * uuid, so the first group of it is short, unique and stable.
 */
export function receiptReference(paymentId: string): string {
  const cleaned = paymentId.replace(/-/g, "");
  return `RCP-${cleaned.slice(0, 8).toUpperCase()}`;
}

/**
 * Whether an invoice belongs in a statement's charges column.
 *
 * Void and waived invoices are excluded: a void invoice was raised in error and
 * a waived one has been written off, so neither is money the family owes. They
 * are reported separately by the statement rather than dropped silently, so a
 * family that can see a charge listed somewhere in the app can always find it
 * accounted for on the statement.
 */
export function isChargeableStatus(status: FeeInvoiceStatus): boolean {
  return status === "unpaid" || status === "partially_paid" || status === "paid";
}

export type InvoiceTotalsInput = {
  amount: number;
  amount_paid: number;
  status: FeeInvoiceStatus;
};

/**
 * The three figures on the parent's fees page.
 *
 * Waived and void invoices are left out of "billed" as well as out of what is
 * owed. That is what keeps the three tiles reconciling: billed minus paid is
 * exactly outstanding. Totalling a waiver into the billed figure while leaving
 * it out of the balance is how a parent ends up reading 505,000 - 185,000
 * against an "outstanding" of 280,000 and concluding the app is broken.
 *
 * Pure and total so the invariant can be tested without a database.
 */
export function computeInvoiceTotals(invoices: InvoiceTotalsInput[]): {
  invoiced: number;
  paid: number;
  outstanding: number;
} {
  const chargeable = invoices.filter((i) => isChargeableStatus(i.status));
  return {
    invoiced: roundMoney(chargeable.reduce((s, i) => s + Number(i.amount), 0)),
    paid: roundMoney(chargeable.reduce((s, i) => s + Number(i.amount_paid), 0)),
    outstanding: roundMoney(
      invoices
        .filter((i) => isPayableStatus(i.status))
        .reduce((s, i) => s + outstandingFor(i), 0),
    ),
  };
}

export type StatementCharge = {
  id: string;
  date: string;
  description: string;
  /** What the school billed. */
  amount: number;
  status: FeeInvoiceStatus;
};

export type StatementCredit = {
  id: string;
  date: string;
  description: string;
  /** What was tendered, which may exceed what was credited. */
  tendered: number;
  /**
   * What the approval moved onto the invoice. Null for a payment approved
   * before credited_amount existed and not yet backfilled.
   */
  credited: number | null;
  reference: string;
};

export type StatementRow = {
  key: string;
  date: string;
  description: string;
  /** Positive adds to what is owed; negative reduces it. */
  movement: number;
  /** Owed after this row. */
  balance: number;
  kind: "charge" | "credit";
  reference: string | null;
};

export type Statement = {
  rows: StatementRow[];
  /** Everything the school has billed across the excluded invoices too. */
  totalCharged: number;
  /** Everything actually credited to invoices. */
  totalCredited: number;
  /** What the family owes now. Never negative. */
  closingBalance: number;
  currency: string;
  generatedAt: string;
  /** Charges excluded from the ledger, so nothing is unaccounted for. */
  excluded: { description: string; amount: number; status: FeeInvoiceStatus }[];
  /**
   * A credit whose `credited` figure is unknown -- an approval from before
   * 0017. Surfaced so the statement can warn rather than quietly understate.
   */
  hasUnbackedCredits: boolean;
};

function sortKey(date: string, tiebreak: string): string {
  return `${date}|${tiebreak}`;
}

/**
 * Interleaves one child's charges and credits into a single dated ledger with a
 * running balance.
 *
 * Two things this gets right that a naive sum does not:
 *
 *  - It credits `credited`, not `tendered`. A parent who overpays has handed
 *    over more than the school kept, and counting the difference as a credit
 *    would drive the balance below what is genuinely owed.
 *  - A credit with no recorded `credited` amount is treated as worth its
 *    tendered amount and flagged, because understating the credit would overstate
 *    the debt. `hasUnbackedCredits` lets the caller say so out loud.
 *
 * A credit dated before its own invoice would open the ledger at a negative
 * balance; the running balance is clamped at zero for display, while
 * `closingBalance` stays honest and is never negative.
 */
export function buildStatement(input: {
  charges: StatementCharge[];
  credits: StatementCredit[];
  currency: string;
  generatedAt: string;
}): Statement {
  const entries: {
    date: string;
    tiebreak: string;
    description: string;
    movement: number;
    kind: "charge" | "credit";
    reference: string | null;
  }[] = [];

  const excluded: Statement["excluded"] = [];
  let totalCharged = 0;

  for (const charge of input.charges) {
    if (!isChargeableStatus(charge.status)) {
      excluded.push({
        description: charge.description,
        amount: charge.amount,
        status: charge.status,
      });
      continue;
    }
    // Only what reaches the ledger counts toward the total, so that
    // totalCharged - totalCredited is always exactly the closing balance. A
    // waived charge added here would print a statement whose own three
    // headline figures do not reconcile, which is the first thing a parent
    // checks.
    totalCharged = roundMoney(totalCharged + charge.amount);
    entries.push({
      date: charge.date,
      tiebreak: `0${charge.id}`,
      description: charge.description,
      movement: roundMoney(charge.amount),
      kind: "charge",
      reference: null,
    });
  }

  let totalCredited = 0;
  let hasUnbackedCredits = false;

  for (const credit of input.credits) {
    const value = credit.credited ?? credit.tendered;
    if (credit.credited === null) hasUnbackedCredits = true;
    totalCredited = roundMoney(totalCredited + value);
    entries.push({
      date: credit.date,
      // A credit sorts after a charge billed the same day, so a payment made
      // on the morning an invoice lands reads in the order it happened.
      tiebreak: `1${credit.id}`,
      description: credit.description,
      movement: roundMoney(-value),
      kind: "credit",
      reference: credit.reference,
    });
  }

  entries.sort((a, b) => sortKey(a.date, a.tiebreak).localeCompare(sortKey(b.date, b.tiebreak)));

  let running = 0;
  const rows: StatementRow[] = entries.map((entry) => {
    running = roundMoney(running + entry.movement);
    return {
      key: `${entry.kind}:${entry.tiebreak.slice(1)}`,
      date: entry.date,
      description: entry.description,
      movement: entry.movement,
      balance: Math.max(0, running),
      kind: entry.kind,
      reference: entry.reference,
    };
  });

  return {
    rows,
    totalCharged,
    totalCredited,
    closingBalance: Math.max(0, running),
    currency: input.currency,
    generatedAt: input.generatedAt,
    excluded,
    hasUnbackedCredits,
  };
}

