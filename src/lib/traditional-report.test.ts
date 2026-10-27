import { describe, expect, it } from "vitest";
import {
  emptySubject,
  recalculateSubject,
  toNumberOrNull,
} from "@/lib/traditional-report";

describe("toNumberOrNull", () => {
  it("treats a blank field as not entered rather than zero", () => {
    expect(toNumberOrNull("")).toBeNull();
    expect(toNumberOrNull("   ")).toBeNull();
  });

  it("parses numbers and rejects junk", () => {
    expect(toNumberOrNull("18")).toBe(18);
    expect(toNumberOrNull("12.5")).toBe(12.5);
    expect(toNumberOrNull("nope")).toBeNull();
  });
});

describe("recalculateSubject", () => {
  it("keeps an empty row blank instead of showing zero", () => {
    const row = recalculateSubject(emptySubject("Mathematics"));
    expect(row.totalTests).toBeNull();
    expect(row.overall).toBeNull();
  });

  it("adds the three tests and then the exam", () => {
    const row = recalculateSubject({
      ...emptySubject("English Language"),
      test1: 18,
      test2: 17,
      test3: 16,
      exam: 48,
    });
    expect(row.totalTests).toBe(51);
    expect(row.overall).toBe(99);
  });

  it("still computes a total when only some tests are entered", () => {
    const row = recalculateSubject({
      ...emptySubject("Biology"),
      test1: 10,
      exam: 40,
    });
    expect(row.totalTests).toBe(10);
    expect(row.overall).toBe(50);
  });

  it("computes overall from the exam alone", () => {
    const row = recalculateSubject({
      ...emptySubject("Chemistry"),
      exam: 55,
    });
    expect(row.totalTests).toBeNull();
    expect(row.overall).toBe(55);
  });

  it("leaves unrelated columns untouched", () => {
    const row = recalculateSubject({
      ...emptySubject("Physics"),
      test1: 5,
      lastTerm: 70,
      grade: "A",
    });
    expect(row.lastTerm).toBe(70);
    expect(row.grade).toBe("A");
  });
});
