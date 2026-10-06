import { describe, expect, it } from "vitest";
import {
  describeAccessBlock,
  evaluateLearningAccess,
  normaliseThreshold,
  standingFromInvoices,
} from "@/lib/fee-gate";

describe("normaliseThreshold", () => {
  it("clamps to a whole percentage inside 0-100", () => {
    expect(normaliseThreshold(45.5)).toBe(46);
    expect(normaliseThreshold(-10)).toBe(0);
    expect(normaliseThreshold(140)).toBe(100);
  });

  it("treats nonsense as off rather than throwing", () => {
    expect(normaliseThreshold(null)).toBe(0);
    expect(normaliseThreshold(undefined)).toBe(0);
    expect(normaliseThreshold("")).toBe(0);
    expect(normaliseThreshold("abc")).toBe(0);
    expect(normaliseThreshold(NaN)).toBe(0);
  });

  it("accepts the numeric string a form field sends", () => {
    expect(normaliseThreshold("75")).toBe(75);
  });
});

describe("evaluateLearningAccess", () => {
  const bill = { invoiced: 200_000, paid: 0, outstanding: 200_000 };

  it("allows everything when the school has not set a threshold", () => {
    const decision = evaluateLearningAccess(0, bill);
    expect(decision.gateActive).toBe(false);
    expect(decision.allowed).toBe(true);
    expect(decision.required).toBe(0);
  });

  it("allows everything when nothing has ever been billed", () => {
    // 0% of 0 is not a reason to withhold a lesson. A school that has not raised
    // an invoice is not entitled to lock a pupil out over a balance of zero.
    const decision = evaluateLearningAccess(100, {
      invoiced: 0,
      paid: 0,
      outstanding: 0,
    });
    expect(decision.gateActive).toBe(false);
    expect(decision.allowed).toBe(true);
    expect(decision.paidPct).toBe(100);
  });

  it("blocks a student who has paid nothing once switched on", () => {
    const decision = evaluateLearningAccess(50, bill);
    expect(decision.gateActive).toBe(true);
    expect(decision.allowed).toBe(false);
    expect(decision.paidPct).toBe(0);
    expect(decision.required).toBe(100_000);
  });

  it("allows a student who has paid exactly the threshold", () => {
    const decision = evaluateLearningAccess(50, { ...bill, paid: 100_000 });
    expect(decision.allowed).toBe(true);
    expect(decision.required).toBe(0);
    expect(decision.paidPct).toBe(50);
  });

  it("keeps blocking one naira short of the threshold", () => {
    const decision = evaluateLearningAccess(50, { ...bill, paid: 99_999 });
    expect(decision.allowed).toBe(false);
    expect(decision.required).toBe(1);
  });

  it("reports the amount still owed rather than only a percentage", () => {
    const decision = evaluateLearningAccess(60, { ...bill, paid: 25_000 });
    expect(decision.allowed).toBe(false);
    // 60% of 200,000 is 120,000; 25,000 paid leaves 95,000.
    expect(decision.required).toBe(95_000);
    expect(decision.paidPct).toBe(13);
  });

  it("opens the gate at 0% so a school can demand payment in full", () => {
    // 100% is the only meaningful full-payment gate; 0 is always "off".
    const decision = evaluateLearningAccess(100, { ...bill, paid: 199_999 });
    expect(decision.allowed).toBe(false);
    expect(decision.required).toBe(1);
    expect(evaluateLearningAccess(100, { ...bill, paid: 200_000 }).allowed).toBe(true);
  });

  it("never reports more than 100% paid when a family overpays", () => {
    const decision = evaluateLearningAccess(50, { ...bill, paid: 250_000 });
    expect(decision.paidPct).toBe(100);
    expect(decision.allowed).toBe(true);
  });

  it("ignores negative figures rather than inverting the decision", () => {
    const decision = evaluateLearningAccess(50, {
      invoiced: -100,
      paid: -50,
      outstanding: -100,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.invoiced).toBe(0);
    expect(decision.paid).toBe(0);
  });

  it("says nothing when access is allowed", () => {
    expect(describeAccessBlock(evaluateLearningAccess(0, bill))).toBe("");
    expect(describeAccessBlock(evaluateLearningAccess(50, { ...bill, paid: 200_000 }))).toBe(
      "",
    );
  });

  it("names the threshold, the shortfall and what is still owed", () => {
    const sentence = describeAccessBlock(evaluateLearningAccess(50, { ...bill, paid: 50_000 }));
    expect(sentence).toContain("50%");
    expect(sentence).toContain("25%");
    expect(sentence).toContain("50,000");
  });
});

describe("standingFromInvoices", () => {
  it("leaves a waived invoice out of the bill, which is the exemption", () => {
    // A bursary is expressed by waiving the invoice. Because computeInvoiceTotals
    // already excludes waived rows, a fully waived student is not gated at all.
    const standing = standingFromInvoices([
      { amount: 200_000, amount_paid: 0, status: "waived" },
    ]);
    expect(standing.invoiced).toBe(0);
    expect(standing.outstanding).toBe(0);
    expect(evaluateLearningAccess(100, standing).allowed).toBe(true);
  });

  it("leaves a void invoice out too", () => {
    const standing = standingFromInvoices([
      { amount: 200_000, amount_paid: 0, status: "void" },
    ]);
    expect(standing.invoiced).toBe(0);
  });

  it("sums several invoices and reconciles invoiced - paid with outstanding", () => {
    const standing = standingFromInvoices([
      { amount: 100_000, amount_paid: 100_000, status: "paid" },
      { amount: 50_000, amount_paid: 20_000, status: "partially_paid" },
      { amount: 25_000, amount_paid: 0, status: "unpaid" },
    ]);
    expect(standing.invoiced).toBe(175_000);
    expect(standing.paid).toBe(120_000);
    expect(standing.outstanding).toBe(55_000);
    expect(standing.invoiced - standing.paid).toBe(standing.outstanding);
  });

  it("gates on the whole bill across terms, not one invoice", () => {
    const standing = standingFromInvoices([
      { amount: 100_000, amount_paid: 100_000, status: "paid" },
      { amount: 100_000, amount_paid: 0, status: "unpaid" },
    ]);
    // Paid in full last term, nothing this term: 50% of 200,000 is 100,000, which
    // has been met, so the gate opens.
    expect(evaluateLearningAccess(50, standing).allowed).toBe(true);
  });

  it("reads the amounts whether they arrive as numbers or strings", () => {
    const standing = standingFromInvoices([
      { amount: "100000", amount_paid: "60000", status: "partially_paid" },
    ]);
    expect(standing.invoiced).toBe(100_000);
    expect(standing.paid).toBe(60_000);
  });
});