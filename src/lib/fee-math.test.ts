import { describe, expect, it } from "vitest";
import {
  applyApproval,
  buildBillingKey,
  buildFeeReference,
  fromMinorUnits,
  isFeeReference,
  isOverdue,
  isPayableStatus,
  isSubscriptionReference,
  outstandingFor,
  paidFraction,
  roundMoney,
  statusForAmounts,
  toMinorUnits,
} from "@/lib/fee-math";

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
