import { describe, expect, it } from "vitest";
import {
  applyApproval,
  buildBillingKey,
  buildFeeReference,
  buildStatement,
  fromMinorUnits,
  isFeeReference,
  isOverdue,
  isPayableStatus,
  isSubscriptionReference,
  outstandingFor,
  paidFraction,
  receiptReference,
  roundMoney,
  statusForAmounts,
  toMinorUnits,
  type StatementCharge,
  type StatementCredit,
} from "@/lib/fee-math";
import type { FeeInvoiceStatus } from "@/types/database";

describe("reference prefixes", () => {
  it("marks fee references and leaves subscription references alone", () => {
    expect(isFeeReference(buildFeeReference())).toBe(true);
    expect(isSubscriptionReference("ed_abc123")).toBe(true);
    // The webhook dispatches on this, so the two must never be confused.
    expect(isFeeReference("ed_abc123")).toBe(false);
    expect(isSubscriptionReference(buildFeeReference())).toBe(false);
  });

  it("never repeats a reference", () => {
    const seen = new Set(Array.from({ length: 500 }, () => buildFeeReference()));
    expect(seen.size).toBe(500);
  });
});

describe("rounding and minor units", () => {
  it("snaps money to 2dp so a settled invoice cannot look short", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(100 / 3)).toBe(33.33);
  });

  it("round-trips through Paystack kobo without losing anything", () => {
    expect(toMinorUnits(5000)).toBe(500000);
    expect(fromMinorUnits(500000)).toBe(5000);
    // 33.33 naira is 3333 kobo and must not drift on the way back
    expect(fromMinorUnits(toMinorUnits(33.33))).toBe(33.33);
  });
});

describe("outstanding balance", () => {
  it("is the amount still owed while payable", () => {
    expect(outstandingFor({ amount: 100, amount_paid: 0, status: "unpaid" })).toBe(100);
    expect(
      outstandingFor({ amount: 100, amount_paid: 40, status: "partially_paid" }),
    ).toBe(60);
  });

  it("is zero once settled, waived or void", () => {
    for (const status of ["paid", "waived", "void"] as const) {
      expect(outstandingFor({ amount: 100, amount_paid: 0, status })).toBe(0);
    }
  });

  it("never goes negative if the rows drift", () => {
    expect(
      outstandingFor({ amount: 100, amount_paid: 150, status: "partially_paid" }),
    ).toBe(0);
  });
});

describe("invoice status from amounts", () => {
  it("moves through unpaid, partial, then paid", () => {
    expect(statusForAmounts(100, 0)).toBe("unpaid");
    expect(statusForAmounts(100, 1)).toBe("partially_paid");
    expect(statusForAmounts(100, 99.99)).toBe("partially_paid");
    expect(statusForAmounts(100, 100)).toBe("paid");
  });

  it("treats an overpayment as paid rather than leaving it partial", () => {
    expect(statusForAmounts(100, 250)).toBe("paid");
  });
});

describe("approving a payment", () => {
  it("credits a part payment and leaves the invoice partly paid", () => {
    const r = applyApproval({ amount: 100, amount_paid: 0 }, 40);
    expect(r).toEqual({
      amountPaid: 40,
      credited: 40,
      status: "partially_paid",
      uncredited: 0,
    });
  });

  it("settles the invoice on the final payment", () => {
    const r = applyApproval({ amount: 100, amount_paid: 60 }, 40);
    expect(r.amountPaid).toBe(100);
    expect(r.credited).toBe(40);
    expect(r.status).toBe("paid");
    expect(r.uncredited).toBe(0);
  });

  it("clamps an overpayment to what is owed and reports the surplus", () => {
    // Without clamping this would violate the database's
    // amount_paid <= amount check and strand the payment in the queue.
    const r = applyApproval({ amount: 100, amount_paid: 0 }, 150);
    expect(r.credited).toBe(100);
    expect(r.amountPaid).toBe(100);
    expect(r.status).toBe("paid");
    expect(r.uncredited).toBe(50);
  });

  it("credits nothing when the invoice is already fully paid", () => {
    const r = applyApproval({ amount: 100, amount_paid: 100 }, 100);
    expect(r.credited).toBe(0);
    expect(r.uncredited).toBe(100);
    expect(r.amountPaid).toBe(100);
  });

  it("only ever credits the outstanding balance across two approvals", () => {
    // This is the double-approval case: both bursars read amount_paid = 0 and
    // both try to credit 100 against a 100 invoice.
    const first = applyApproval({ amount: 100, amount_paid: 0 }, 100);
    const second = applyApproval(
      { amount: 100, amount_paid: first.amountPaid },
      100,
    );
    expect(first.amountPaid).toBe(100);
    // The second credits nothing rather than pushing the invoice to 200.
    expect(second.credited).toBe(0);
    expect(second.amountPaid).toBe(100);
  });

  it("keeps 50/50 approvals from over-crediting a three-way split", () => {
    const a = applyApproval({ amount: 300, amount_paid: 0 }, 100);
    const b = applyApproval({ amount: 300, amount_paid: a.amountPaid }, 100);
    const c = applyApproval({ amount: 300, amount_paid: b.amountPaid }, 100);
    expect([a.amountPaid, b.amountPaid, c.amountPaid]).toEqual([100, 200, 300]);
    expect(c.status).toBe("paid");
    expect(c.uncredited).toBe(0);
  });

  it("ignores a negative or zero payment amount", () => {
    const r = applyApproval({ amount: 100, amount_paid: 0 }, -50);
    expect(r.credited).toBe(0);
    expect(r.amountPaid).toBe(0);
    expect(r.status).toBe("unpaid");
  });
});

describe("overdue", () => {
  const today = "2026-03-15";

  it("flags a passed due date on a payable invoice", () => {
    expect(isOverdue({ status: "unpaid", dueDate: "2026-03-14", today })).toBe(true);
    expect(isOverdue({ status: "partially_paid", dueDate: "2026-01-01", today })).toBe(
      true,
    );
  });

  it("is not overdue today, in the future, or once settled", () => {
    expect(isOverdue({ status: "unpaid", dueDate: "2026-03-15", today })).toBe(false);
    expect(isOverdue({ status: "unpaid", dueDate: "2026-04-01", today })).toBe(false);
    expect(isOverdue({ status: "paid", dueDate: "2026-01-01", today })).toBe(false);
    expect(isOverdue({ status: "waived", dueDate: "2026-01-01", today })).toBe(false);
  });

  it("is never overdue without a due date", () => {
    expect(isOverdue({ status: "unpaid", dueDate: null, today })).toBe(false);
  });
});

describe("misc helpers", () => {
  it("treats waived and void as not payable", () => {
    expect(isPayableStatus("unpaid")).toBe(true);
    expect(isPayableStatus("partially_paid")).toBe(true);
    expect(isPayableStatus("paid")).toBe(false);
    expect(isPayableStatus("waived")).toBe(false);
    expect(isPayableStatus("void")).toBe(false);
  });

  it("derives a stable billing key so bulk generation is idempotent", () => {
    const a = buildBillingKey({ termId: "t1", classId: "c1" });
    const b = buildBillingKey({ termId: "t1", classId: "c1" });
    expect(a).toBe(b);
    // A different class or term must be a different key, or a school could
    // never bill two classes for the same term.
    expect(buildBillingKey({ termId: "t1", classId: "c2" })).not.toBe(a);
    expect(buildBillingKey({ termId: "t2", classId: "c1" })).not.toBe(a);
    expect(buildBillingKey({ termId: "t1", classId: null })).not.toBe(a);
  });

  it("clamps the paid fraction for the progress meter", () => {
    expect(paidFraction(100, 0)).toBe(0);
    expect(paidFraction(100, 50)).toBe(0.5);
    expect(paidFraction(100, 100)).toBe(1);
    expect(paidFraction(100, 150)).toBe(1);
    expect(paidFraction(0, 0)).toBe(1);
  });
});

describe("receipt references", () => {
  it("is short enough to read out and stable for one payment", () => {
    const id = "3f9a2b1c-4d5e-6f70-8192-a3b4c5d6e7f8";
    expect(receiptReference(id)).toBe("RCP-3F9A2B1C");
    expect(receiptReference(id)).toBe(receiptReference(id));
  });

  it("does not leak the provider reference into a document", () => {
    const ref = receiptReference("3f9a2b1c-4d5e-6f70-8192-a3b4c5d6e7f8");
    expect(ref).not.toContain("fee_");
    expect(ref.length).toBeLessThanOrEqual(12);
  });
});

describe("buildStatement", () => {
  const charge = (
    id: string,
    date: string,
    amount: number,
    status: FeeInvoiceStatus = "unpaid",
    description = "First term fees",
  ): StatementCharge => ({ id, date, description, amount, status });

  const credit = (
    id: string,
    date: string,
    tendered: number,
    credited: number | null,
    description = "First term fees",
  ): StatementCredit => ({
    id,
    date,
    description,
    tendered,
    credited,
    reference: receiptReference(id),
  });

  it("runs a balance forward through charges and credits in date order", () => {
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [
        charge("i1", "2026-01-10", 50000),
        charge("i2", "2026-04-10", 30000, "unpaid", "Second term fees"),
      ],
      credits: [credit("p1", "2026-02-01", 50000, 50000)],
    });

    expect(statement.rows.map((r) => r.balance)).toEqual([50000, 0, 30000]);
    expect(statement.totalCharged).toBe(80000);
    expect(statement.totalCredited).toBe(50000);
    expect(statement.closingBalance).toBe(30000);
  });

  it("credits what was credited, not what was tendered", () => {
    // A parent pays 60000 against a 50000 invoice. The school keeps 50000 and
    // the surplus is not a credit against anything.
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [charge("i1", "2026-01-10", 50000, "paid")],
      credits: [credit("p1", "2026-01-20", 60000, 50000)],
    });

    expect(statement.totalCredited).toBe(50000);
    expect(statement.closingBalance).toBe(0);
  });

  it("keeps the closing balance equal to the sum of what is still owed", () => {
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [
        charge("i1", "2026-01-10", 50000, "paid"),
        charge("i2", "2026-01-10", 20000, "partially_paid"),
        charge("i3", "2026-01-10", 10000, "unpaid"),
      ],
      credits: [credit("p1", "2026-01-15", 50000, 50000)],
    });

    // 20000 + 10000 still owed across the two unpaid invoices. The running
    // balance peaks at 80000 before the credit lands, so this has to be read
    // off the last row rather than the maximum.
    expect(statement.closingBalance).toBe(30000);
    expect(statement.rows[statement.rows.length - 1].balance).toBe(30000);
    expect(
      statement.totalCharged - statement.totalCredited,
    ).toBe(statement.closingBalance);
  });

  it("leaves a void or waived invoice out of the ledger but still reports it", () => {
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [
        charge("i1", "2026-01-10", 50000, "unpaid"),
        charge("i2", "2026-01-10", 9999, "void", "Raised in error"),
        charge("i3", "2026-01-10", 5000, "waived", "Scholarship"),
      ],
      credits: [],
    });

    expect(statement.closingBalance).toBe(50000);
    expect(statement.rows).toHaveLength(1);
    expect(statement.excluded.map((e) => e.description).sort()).toEqual([
      "Raised in error",
      "Scholarship",
    ]);
    // Only the live invoice is totalled. Including the void and waived amounts
    // here would print "charged 64999, credited 0, balance 50000", and the
    // family is right to distrust those three numbers not reconciling.
    expect(statement.totalCharged).toBe(50000);
    expect(statement.totalCredited).toBe(0);
    expect(statement.totalCharged - statement.totalCredited).toBe(
      statement.closingBalance,
    );
  });

  it("keeps the three headline figures reconciling once credits are involved", () => {
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [
        charge("i1", "2026-01-10", 50000, "paid"),
        charge("i2", "2026-04-10", 20000, "partially_paid"),
        charge("i3", "2026-07-10", 10000, "unpaid"),
        charge("i4", "2026-07-11", 5000, "waived"),
      ],
      credits: [
        credit("p1", "2026-01-15", 50000, 50000),
        credit("p2", "2026-04-15", 12000, 12000),
      ],
    });

    // 50000 + 20000 + 10000 on the ledger; 50000 + 12000 received.
    expect(statement.totalCharged).toBe(80000);
    expect(statement.totalCredited).toBe(62000);
    expect(statement.closingBalance).toBe(18000);
    expect(statement.totalCharged - statement.totalCredited).toBe(
      statement.closingBalance,
    );
  });

  it("flags a credit approved before credited_amount was recorded", () => {
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [charge("i1", "2026-01-10", 50000)],
      credits: [credit("p1", "2026-01-20", 20000, null)],
    });

    expect(statement.hasUnbackedCredits).toBe(true);
    // Assumed worth the tendered amount, because assuming zero would overstate
    // what the family owes.
    expect(statement.totalCredited).toBe(20000);
    expect(statement.closingBalance).toBe(30000);
  });

  it("never shows a negative running balance", () => {
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [charge("i1", "2026-02-01", 10000)],
      // A payment dated before the invoice it settles.
      credits: [credit("p1", "2026-01-01", 10000, 10000)],
    });

    expect(statement.rows.map((r) => r.balance)).toEqual([0, 0]);
    expect(statement.closingBalance).toBe(0);
  });

  it("orders a payment made on the same day after the invoice it pays", () => {
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [charge("i1", "2026-01-10", 10000)],
      credits: [credit("p1", "2026-01-10", 10000, 10000)],
    });

    expect(statement.rows.map((r) => r.kind)).toEqual(["charge", "credit"]);
  });

  it("handles a child with no history at all", () => {
    const statement = buildStatement({
      currency: "NGN",
      generatedAt: "2026-09-30T00:00:00.000Z",
      charges: [],
      credits: [],
    });

    expect(statement.rows).toEqual([]);
    expect(statement.closingBalance).toBe(0);
    expect(statement.hasUnbackedCredits).toBe(false);
  });
});

