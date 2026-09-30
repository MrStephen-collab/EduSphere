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
